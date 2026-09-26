import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Не найден элемент для запуска приложения.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
