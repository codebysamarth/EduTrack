import axios from 'axios'

const aiApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AI_URL,
  headers: { 'Content-Type': 'application/json' },
})

aiApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('college_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

aiApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('college_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export { aiApi }
