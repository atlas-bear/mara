import React from 'react';
import { NovuProvider } from '@novu/notification-center';
import EmailTemplate from './components/EmailTemplate';
import PreviewMode from './components/PreviewMode';

const FlashReport = () => {
  return (
    <NovuProvider
      applicationIdentifier={process.env.NOVU_APP_IDENTIFIER}
      subscriberId={/* TODO: Add subscriber ID logic */}
    >
      <div>
        {/* TODO: Add main flash report logic */}
      </div>
    </NovuProvider>
  );
};

export default FlashReport;