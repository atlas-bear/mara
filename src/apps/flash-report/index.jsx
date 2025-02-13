import React from 'react';
import PreviewMode from './components/PreviewMode';

const FlashReport = ({ incident }) => {
  return (
    <div className="container mx-auto px-4">
      <PreviewMode incident={incident} />
    </div>
  );
};

export default FlashReport;