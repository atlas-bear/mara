import { Novu } from '@novu/node';

const novu = new Novu(process.env.NOVU_API_KEY);

export const initializeSubscriber = async (userData) => {
  try {
    // TODO: Add subscriber initialization logic
  } catch (error) {
    console.error('Error initializing subscriber:', error);
    throw error;
  }
};

export const sendNotification = async (incident, subscribers) => {
  try {
    // TODO: Add notification sending logic
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};