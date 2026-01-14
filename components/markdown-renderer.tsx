"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-gray max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 style={{ marginBottom: '1rem', fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ marginBottom: '0.75rem', marginTop: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ marginBottom: '0.5rem', marginTop: '1rem', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>{children}</h3>,
          p: ({ children }) => <p style={{ marginBottom: '1rem', color: '#374151', lineHeight: '1.7' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ marginBottom: '1rem', marginLeft: '1.5rem', listStyleType: 'disc', color: '#374151' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ marginBottom: '1rem', marginLeft: '1.5rem', listStyleType: 'decimal', color: '#374151' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote style={{ margin: '1rem 0', borderLeft: '4px solid #d1d5db', backgroundColor: '#f9fafb', paddingLeft: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', fontStyle: 'italic', color: '#6b7280' }}>
              {children}
            </blockquote>
          ),
          code: ({ inline, children }: any) =>
            inline ? (
              <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontFamily: 'monospace', fontSize: '0.875rem', color: '#1f2937' }}>
                {children}
              </code>
            ) : (
              <code style={{ display: 'block', overflowX: 'auto', borderRadius: '0.375rem', background: '#1f2937', color: '#f9fafb', padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {children}
              </code>
            ),
          pre: ({ children }) => <pre style={{ margin: '1rem 0' }}>{children}</pre>,
          a: ({ children, href }) => (
            <a href={href} style={{ color: '#2563eb', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong style={{ fontWeight: 'bold', color: '#111827' }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
