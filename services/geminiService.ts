import { GoogleGenAI, Content, Part, Modality } from "@google/genai";
import { Message, Role, PersonaKey, Persona, Attachment, KnowledgeDocument } from '../types';
import { GEMINI_MODEL_FAST, GEMINI_MODEL_REASONING, GEMINI_MODEL_TTS } from '../constants';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const streamMessage = async (
  history: Message[],
  newMessage: string,
  persona: Persona,
  attachment: Attachment | null,
  onChunk: (text: string) => void,
  customModelId?: string,
  temperature: number = 0.7,
  projectFiles: KnowledgeDocument[] = [],
  globalKB: KnowledgeDocument[] = []
): Promise<string> => {
  
  // Logic to select model
  let modelName = GEMINI_MODEL_FAST;

  if (persona.modelPreference === 'reasoning') {
    modelName = GEMINI_MODEL_REASONING;
  } else if (persona.modelPreference === 'custom') {
    if (customModelId && customModelId.trim() !== '') {
      modelName = customModelId;
    } else {
      // Fallback if they selected the SLM persona but didn't provide an ID
      modelName = GEMINI_MODEL_FAST; 
    }
  }

  // Construct System Instruction with Knowledge Base
  let finalSystemInstruction = persona.systemInstruction;
  
  // Inject Global Knowledge Base (Reference Material)
  if (globalKB.length > 0) {
    const kbContent = globalKB.map(doc => 
      `--- REFERENCE DOC (${doc.name}) ---\n${doc.content}\n---------------------------`
    ).join('\n\n');

    finalSystemInstruction += `\n\n### GLOBAL KNOWLEDGE BASE (REFERENCE LIBRARY) ###\nYou have access to the following persistent reference materials (e.g., ML concepts, Agency Guidelines). Use these to ensure technical accuracy and consistency across all projects:\n\n${kbContent}`;
  }

  // Inject Project Files (Context Specific)
  if (projectFiles.length > 0) {
    const pfContent = projectFiles.map(doc => 
      `--- PROJECT FILE (${doc.name}) ---\n${doc.content}\n---------------------------`
    ).join('\n\n');

    finalSystemInstruction += `\n\n### PROJECT FILES (CURRENT CONTEXT) ###\nThe following files are specific to the ACTIVE PROJECT. This is your primary source of truth for data, specifications, and code for the current task:\n\n${pfContent}`;
  }

  const config: any = {
    systemInstruction: finalSystemInstruction,
    temperature: temperature,
  };

  // Add thinking budget if using reasoning model (and it's not a custom tuned model, unless tuned supports thinking)
  if (modelName === GEMINI_MODEL_REASONING) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  try {
    // 1. Build History
    const contents: Content[] = history
      .filter(msg => !msg.isError)
      .map((msg) => {
        const parts: Part[] = [];
        // Add attachment to history if it exists
        if (msg.attachment) {
           const isInline = msg.attachment.type === 'image' || msg.attachment.mimeType === 'application/pdf';
           if (isInline) {
             parts.push({
               inlineData: {
                 mimeType: msg.attachment.mimeType,
                 data: msg.attachment.data
               }
             });
           } else {
             // Text-based file (code, csv, json, etc.)
             try {
                const decodedText = atob(msg.attachment.data);
                parts.push({ text: `[Context: Attached file '${msg.attachment.fileName}']\n${decodedText}\n---` });
             } catch (e) {
                console.warn("Failed to decode attachment text", e);
             }
           }
        }
        if (msg.text) {
          parts.push({ text: msg.text });
        }
        return {
          role: msg.role === Role.USER ? 'user' : 'model',
          parts: parts,
        };
      });

    // 2. Build Current Message
    const currentParts: Part[] = [];
    if (attachment) {
       const isInline = attachment.type === 'image' || attachment.mimeType === 'application/pdf';
       if (isInline) {
          currentParts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data
            }
          });
       } else {
          try {
            const decodedText = atob(attachment.data);
            currentParts.push({ text: `[Context: Attached file '${attachment.fileName}']\n${decodedText}\n---` });
          } catch (e) {
            console.warn("Failed to decode attachment text", e);
          }
       }
    }
    currentParts.push({ text: newMessage });

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    // 3. Call API
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: config
    });

    let fullText = "";

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }

    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// Helper: Transcribe Audio using Gemini Flash
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Convert Blob to Base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
    });
    reader.readAsDataURL(audioBlob);
    const base64Data = await base64Promise;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_FAST,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/mp3', // Assuming generic audio container, API detects format usually
              data: base64Data
            }
          },
          { text: "Transcribe this audio exactly as spoken. Do not add any commentary." }
        ]
      }
    });
    
    return response.text || "";
  } catch (e) {
    console.error("Transcription error", e);
    throw e;
  }
};

// Helper: Text to Speech
export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TTS,
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Professional voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error("TTS Error", e);
    throw e;
  }
};
