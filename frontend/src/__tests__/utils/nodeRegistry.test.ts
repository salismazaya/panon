import { describe, it, expect } from 'vitest'
import { nodeRegistry } from '../../utils/nodeRegistry'
import type { Node } from '@xyflow/react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<Node> & { id: string; type: string }): Node {
  return {
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  }
}

// ─── Validation Tests ───────────────────────────────────────────────────────

describe('nodeRegistry – validation', () => {

  // ── OnSolReceived ────────────────────────────────────────────────────────

  describe('OnSolReceived.validate', () => {
    const validate = nodeRegistry.OnSolReceived.validate

    it('rejects when assignedVariable has spaces', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'amount with space', assignedSender: 'sender' } })
      expect(validate(node, [node])).not.toBeNull()
    })

    it('rejects when assignedVariable starts with a number', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: '1amount', assignedSender: 'sender' } })
      expect(validate(node, [node])).not.toBeNull()
    })

    it('rejects when assignedVariable is empty', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: '', assignedSender: 'sender' } })
      expect(validate(node, [node])).not.toBeNull()
    })

    it('rejects when assignedSender is empty', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'amount', assignedSender: '' } })
      expect(validate(node, [node])).not.toBeNull()
    })

    it('rejects when variable and sender are the same', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'x', assignedSender: 'x' } })
      expect(validate(node, [node])).not.toBeNull()
    })

    it('rejects duplicate variable names across nodes', () => {
      const node1 = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'amount', assignedSender: 'sender' } })
      const node2 = makeNode({ id: 'n2', type: 'OnSolReceived', data: { assignedVariable: 'amount', assignedSender: 'src2' } })
      expect(validate(node2, [node1, node2])).not.toBeNull()
    })

    it('accepts valid unique variable names', () => {
      const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'amount', assignedSender: 'sender' } })
      expect(validate(node, [node])).toBeNull()
    })
  })

  // ── OnUSDCReceived ───────────────────────────────────────────────────────

  describe('OnUSDCReceived.validate', () => {
    const validate = nodeRegistry.OnUSDCReceived.validate

    it('accepts valid inputs', () => {
      const node = makeNode({ id: 'n1', type: 'OnUSDCReceived', data: { assignedVariable: 'usdcAmt', assignedSender: 'from' } })
      expect(validate(node, [node])).toBeNull()
    })
  })

  // ── If ───────────────────────────────────────────────────────────────────

  describe('If.validate', () => {
    const validate = nodeRegistry.If.validate

    it('rejects when variable is missing', () => {
      const node = makeNode({ id: 'n1', type: 'If', data: { variable: '', operator: '>', comparisonData: { mode: 'value', value: '10' } } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('rejects when comparison value is empty', () => {
      const node = makeNode({ id: 'n1', type: 'If', data: { variable: 'x', operator: '>', comparisonData: { mode: 'value', value: '' } } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('defaults operator to > when not set', () => {
      const node = makeNode({ id: 'n1', type: 'If', data: { variable: 'x', comparisonData: { mode: 'value', value: '5' } } })
      expect(validate(node, [])).toBeNull()
    })

    it('accepts variable-mode comparison', () => {
      const node = makeNode({ id: 'n1', type: 'If', data: { variable: 'x', operator: '==', comparisonData: { mode: 'variable', value: 'y' } } })
      expect(validate(node, [])).toBeNull()
    })

    it('rejects variable-mode with empty value', () => {
      const node = makeNode({ id: 'n1', type: 'If', data: { variable: 'x', operator: '==', comparisonData: { mode: 'variable', value: '' } } })
      expect(validate(node, [])).not.toBeNull()
    })
  })

  // ── Loop ─────────────────────────────────────────────────────────────────

  describe('Loop.validate', () => {
    const validate = nodeRegistry.Loop.validate

    it('rejects when iterations is missing', () => {
      const node = makeNode({ id: 'n1', type: 'Loop', data: {} })
      expect(validate(node, [])).not.toBeNull()
    })

    it('accepts zero iterations', () => {
      const node = makeNode({ id: 'n1', type: 'Loop', data: { iterations: '0' } })
      expect(validate(node, [])).toBeNull()
    })

    it('accepts positive iterations', () => {
      const node = makeNode({ id: 'n1', type: 'Loop', data: { iterations: '10' } })
      expect(validate(node, [])).toBeNull()
    })
  })

  // ── Transfer ─────────────────────────────────────────────────────────────

  describe('Transfer.validate', () => {
    const validate = nodeRegistry.Transfer.validate

    it('rejects when recipientData is missing', () => {
      const node = makeNode({ id: 'n1', type: 'Transfer', data: { amountData: { mode: 'value', value: '100' } } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('rejects when amount is empty', () => {
      const node = makeNode({ id: 'n1', type: 'Transfer', data: {
        recipientData: { mode: 'value', value: '0xABC' },
        amountData: { mode: 'value', value: '' },
      } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('accepts valid value-mode recipient and amount', () => {
      const node = makeNode({ id: 'n1', type: 'Transfer', data: {
        recipientData: { mode: 'value', value: '0xABC' },
        amountData: { mode: 'value', value: '50' },
      } })
      expect(validate(node, [])).toBeNull()
    })

    it('accepts variable-mode fields', () => {
      const node = makeNode({ id: 'n1', type: 'Transfer', data: {
        recipientData: { mode: 'variable', value: 'sender' },
        amountData: { mode: 'variable', value: 'amount' },
      } })
      expect(validate(node, [])).toBeNull()
    })
  })

  // ── GetSolBalance ────────────────────────────────────────────────────────

  describe('GetSolBalance.validate', () => {
    const validate = nodeRegistry.GetSolBalance.validate

    it('rejects when balanceAmount is empty', () => {
      const node = makeNode({ id: 'n1', type: 'GetSolBalance', data: { balanceAmount: '' } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('accepts when balanceAmount is provided', () => {
      const node = makeNode({ id: 'n1', type: 'GetSolBalance', data: { balanceAmount: 'bal' } })
      expect(validate(node, [])).toBeNull()
    })
  })

  // ── Compute ──────────────────────────────────────────────────────────────

  describe('Compute.validate', () => {
    const validate = nodeRegistry.Compute.validate

    it('rejects when assignedVariable is empty', () => {
      const node = makeNode({ id: 'n1', type: 'Compute', data: {
        op1Data: { mode: 'value', value: '1' },
        op2Data: { mode: 'value', value: '2' },
        assignedVariable: '',
      } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('rejects when operand1 is empty', () => {
      const node = makeNode({ id: 'n1', type: 'Compute', data: {
        op1Data: { mode: 'value', value: '' },
        op2Data: { mode: 'value', value: '2' },
        assignedVariable: 'result',
      } })
      expect(validate(node, [])).not.toBeNull()
    })

    it('accepts valid compute with default operator', () => {
      const node = makeNode({ id: 'n1', type: 'Compute', data: {
        op1Data: { mode: 'value', value: '10' },
        op2Data: { mode: 'value', value: '5' },
        assignedVariable: 'sum',
      } })
      expect(validate(node, [])).toBeNull()
    })

    it('accepts variable-mode operands', () => {
      const node = makeNode({ id: 'n1', type: 'Compute', data: {
        op1Data: { mode: 'variable', value: 'a' },
        op2Data: { mode: 'variable', value: 'b' },
        operator: '-',
        assignedVariable: 'diff',
      } })
      expect(validate(node, [])).toBeNull()
    })
  })
})

// ─── Code Generation Tests ──────────────────────────────────────────────────

describe('nodeRegistry – generate', () => {
  const indent = (code: string) => code.split('\n').map(line => '  ' + line).join('\n')
  const dummyContext = {
    getNext: () => '',
    indent,
    nodes: [] as Node[],
  }

  it('OnSolReceived generates function declaration', () => {
    const node = makeNode({ id: 'n1', type: 'OnSolReceived', data: { assignedVariable: 'a', assignedSender: 's' } })
    const lua = nodeRegistry.OnSolReceived.generate(node, dummyContext)
    expect(lua).toContain('function on_sol_received(a, s)')
  })

  it('Transfer generates transferSol() call', () => {
    const node = makeNode({ id: 'n1', type: 'Transfer', data: {
      recipientData: { mode: 'value', value: '0xABC' },
      amountData: { mode: 'value', value: '100' },
    } })
    const lua = nodeRegistry.Transfer.generate(node, dummyContext)
    expect(lua).toBe('transferSol("0xABC", 100)')
  })

  it('TransferToken generates transferToken() call', () => {
    const node = makeNode({ id: 'n1', type: 'TransferToken', data: {
      tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      recipientData: { mode: 'value', value: '0xABC' },
      amountData: { mode: 'value', value: '100' },
    } })
    const lua = nodeRegistry.TransferToken.generate(node, dummyContext)
    expect(lua).toBe('transferToken("0xABC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 100)')
  })

  it('GetSolBalance generates balance assignment', () => {
    const node = makeNode({ id: 'n1', type: 'GetSolBalance', data: { balanceAmount: 'myBal' } })
    const lua = nodeRegistry.GetSolBalance.generate(node, dummyContext)
    expect(lua).toBe('myBal = getBalance(my_address)')
  })

  it('Compute generates local variable assignment', () => {
    const node = makeNode({ id: 'n1', type: 'Compute', data: {
      op1Data: { mode: 'value', value: '10' },
      op2Data: { mode: 'variable', value: 'x' },
      operator: '+',
      assignedVariable: 'total',
    } })
    const lua = nodeRegistry.Compute.generate(node, dummyContext)
    expect(lua).toBe('local total = 10 + x')
  })

  it('If generates conditional block', () => {
    const node = makeNode({ id: 'n1', type: 'If', data: {
      variable: 'amount',
      operator: '>',
      comparisonData: { mode: 'value', value: '100' },
    } })
    const lua = nodeRegistry.If.generate(node, dummyContext)
    expect(lua).toContain('if amount > 100 then')
    expect(lua).toContain('end')
  })

  it('Loop generates for-loop block', () => {
    const node = makeNode({ id: 'n1', type: 'Loop', data: { iterations: '5' } })
    const lua = nodeRegistry.Loop.generate(node, dummyContext)
    expect(lua).toContain('for i=1, 5 do')
    expect(lua).toContain('end')
  })

  it('generates wrapper when functionWrapperName is set', () => {
    const node = makeNode({ id: 'n1', type: 'Transfer', data: {
      recipientData: { mode: 'value', value: '0xA' },
      amountData: { mode: 'value', value: '1' },
      functionWrapperName: 'retry',
    } })
    const lua = nodeRegistry.Transfer.generate(node, dummyContext)
    expect(lua).toContain('retry(function()')
    expect(lua).toContain('end)')
  })
})
