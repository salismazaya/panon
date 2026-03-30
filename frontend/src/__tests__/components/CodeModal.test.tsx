import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CodeModal } from '../../components/CodeModal'

describe('CodeModal', () => {
  const sampleLua = `function on_sol_received(amount, sender)
  if amount > 100 then
    transfer(sender, "SOL", amount)
  end
end`

  it('does not render content when closed', () => {
    render(<CodeModal isOpen={false} onClose={() => {}} code={sampleLua} />)
    expect(screen.queryByText('Generated Lua Script')).not.toBeInTheDocument()
  })

  it('renders modal title and code when open', () => {
    render(<CodeModal isOpen={true} onClose={() => {}} code={sampleLua} />)
    expect(screen.getByText('Generated Lua Script')).toBeInTheDocument()
    // Code is rendered inside a <pre> tag — check key fragments
    expect(screen.getByText(/on_sol_received/)).toBeInTheDocument()
    expect(screen.getByText(/transfer\(sender/)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<CodeModal isOpen={true} onClose={onClose} code={sampleLua} />)

    // The Close text button
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('copies code to clipboard when Copy Code is clicked', () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    window.alert = vi.fn()

    render(<CodeModal isOpen={true} onClose={() => {}} code={sampleLua} />)

    fireEvent.click(screen.getByText('Copy Code'))
    expect(writeTextSpy).toHaveBeenCalledWith(sampleLua)
  })

  it('renders the subtitle text', () => {
    render(<CodeModal isOpen={true} onClose={() => {}} code="" />)
    expect(screen.getByText('Ready for deployment')).toBeInTheDocument()
  })

  it('handles empty code gracefully', () => {
    render(<CodeModal isOpen={true} onClose={() => {}} code="" />)
    // Modal should still render without errors
    expect(screen.getByText('Generated Lua Script')).toBeInTheDocument()
  })
})
