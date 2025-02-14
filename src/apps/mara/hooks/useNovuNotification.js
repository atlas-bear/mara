import { useNovu } from '@novu/notification-center';

export const useNovuNotification = () => {
  const { novu } = useNovu();

  const sendFlashReport = async (incident, subscribers) => {
    try {
      // TODO: Add notification logic
    } catch (error) {
      console.error('Error sending flash report:', error);
      throw error;
    }
  };

  return { sendFlashReport };
};