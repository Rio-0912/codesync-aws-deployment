import axios from 'axios';

const API_URL = '/api';

export const startServer = async (roomCode) => {
  const response = await axios.post(`${API_URL}/rooms/${roomCode}/start-server`);
  return response.data;
};
