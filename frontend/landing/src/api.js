import axios from 'axios';

// The nginx proxy handles routing /api to the backend
const API_URL = '/api';

export const createRoom = async (username, repoUrl) => {
  const response = await axios.post(`${API_URL}/rooms`, { username, repoUrl });
  return response.data;
};
