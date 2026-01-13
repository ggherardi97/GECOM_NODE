const axios = require("axios");
const { apiBaseUrl } = require("../config/api");

const apiClient = axios.create({
    baseURL: apiBaseUrl,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json"
    },
    withCredentials: true // <-- REQUIRED for cookies
});

module.exports = apiClient;
