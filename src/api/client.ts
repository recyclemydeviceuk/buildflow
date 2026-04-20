import axios from 'axios'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api'

export const client = axios.create({
  baseURL: API_URL,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global response interceptor: surface a friendly toast when a demo/read-only
// user attempts a write. The backend returns 403 with code 'DEMO_READ_ONLY'.
// We dispatch a custom window event so any mounted Toast listener can show
// the message without coupling every caller to toast logic.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data
    if (error?.response?.status === 403 && data?.code === 'DEMO_READ_ONLY') {
      try {
        window.dispatchEvent(
          new CustomEvent('buildflow:demo-blocked', {
            detail: {
              message: data.message || 'Demo account is view-only. Editing is disabled.',
            },
          })
        )
      } catch {
        // silently ignore (test env without window)
      }
    }
    return Promise.reject(error)
  }
)
