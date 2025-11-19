import React from 'react';

export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Attachment {
  type: 'image' | 'file';
  data: string; // base64
  mimeType: string;
  fileName?: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: string;
  content: string; // Text content
  timestamp: number;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  isError?: boolean;
  attachment?: Attachment;
}

export enum PersonaKey {
  ORCHESTRATOR = 'ORCHESTRATOR', // The New Unified Model
  BIBLIOTHECA = 'BIBLIOTHECA',   // Custom SLM
  ARCHITECT = 'ARCHITECT',       // System/Platform Architect
  AGENTIC = 'AGENTIC',           // Agentic Workflow Architect
  ENGINEER = 'ENGINEER',         // Data Engineer
  ANALYTICS_ENG = 'ANALYTICS_ENG', // Analytics Engineer
  SCIENTIST = 'SCIENTIST',       // Data Scientist
  ANALYST = 'ANALYST',           // Data Analyst
  RESEARCHER = 'RESEARCHER',     // AI Researcher
  LLM_ENGINEER = 'LLM_ENGINEER', // LLM Engineer
  PROMPT = 'PROMPT',             // Prompt Engineer
  OPS = 'OPS',                   // MLOps
  PRODUCT = 'PRODUCT'            // Data PM
}

export interface Persona {
  key: PersonaKey;
  name: string;
  title: string;
  description: string;
  systemInstruction: string;
  icon: React.ComponentType<any>;
  modelPreference: 'fast' | 'reasoning' | 'custom';
  color: string; // Hex code for UI coloring
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentPersona: PersonaKey;
}