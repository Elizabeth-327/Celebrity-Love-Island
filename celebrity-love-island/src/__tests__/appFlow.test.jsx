import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('app startup flow', () => {
  it('starts at intro and moves to customization', () => {
    render(<App />)

    const startButton = screen.getByRole('button', { name: /start fresh season/i })
    expect(startButton).toBeInTheDocument()

    fireEvent.click(startButton)
    expect(
      screen.getByRole('heading', { name: /choose your career/i }),
    ).toBeInTheDocument()
  })

  it('always starts as a fresh session without reading saved state', () => {
    window.localStorage.setItem('cli_save_v1', '{"phase":"round"}')
    render(<App />)

    expect(
      screen.getByRole('button', { name: /start fresh season/i }),
    ).toBeInTheDocument()
  })
})

