import React from 'react';
import EmailTemplate from '../EmailTemplate';

const PreviewMode = ({ incident }) => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <EmailTemplate incident={incident} />
    </div>
  );
};

export default PreviewMode;