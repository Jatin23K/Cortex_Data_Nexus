import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-cortex-900 prose-pre:border prose-pre:border-cortex-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            return !inline ? (
              <div className="relative group rounded-md overflow-hidden my-4">
                {language && (
                  <div className="absolute top-0 right-0 px-2 py-1 text-xs text-cortex-500 bg-cortex-800 rounded-bl-md border-l border-b border-cortex-700 font-mono uppercase">
                    {language}
                  </div>
                )}
                <pre className={`!bg-[#0d1117] !p-4 !m-0 overflow-x-auto text-sm font-mono border border-cortex-700 rounded-md ${className || ''}`}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-cortex-800 text-cortex-blue px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-cortex-700">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-white mb-3 mt-6">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-white mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-7 text-gray-300">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-gray-300">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-cortex-blue hover:underline break-all">{children}</a>,
          table: ({ children }) => <div className="overflow-x-auto mb-4 border border-cortex-700 rounded"><table className="min-w-full divide-y divide-cortex-700">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-cortex-800 text-left">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 text-sm text-gray-300 border-t border-cortex-700">{children}</td>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-cortex-500 pl-4 italic text-gray-400 my-4">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;