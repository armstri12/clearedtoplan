import { useState, type ReactNode } from 'react';

type TooltipProps = {
  content: string | ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            padding: '8px 12px',
            background: '#1e293b',
            color: '#fff',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: 'normal',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: 300,
            width: 'max-content',
          }}
        >
          {content}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1e293b',
            }}
          />
        </div>
      )}
    </span>
  );
}
