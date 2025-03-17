import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './CodeBlock.module.css';

export default function CodeBlock({ 
  children, 
  language = 'bash', 
  title,
  showLineNumbers = false,
}) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    const code = children.replace(/^\$ /gm, '').trim();
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={styles.codeBlockContainer}>
      {title && (
        <div className={styles.codeBlockTitle}>
          <span>{title}</span>
        </div>
      )}
      <div className={styles.codeBlockContent}>
        <button 
          className={styles.copyButton} 
          onClick={copyToClipboard}
          aria-label="Copy code to clipboard"
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
        <pre className={clsx(
          styles.codeBlock, 
          styles[`language-${language}`],
          {[styles.hasLineNumbers]: showLineNumbers}
        )}>
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}
