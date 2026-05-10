import { describe, it, expect } from 'vitest'
import { compileToLua } from '../../utils/compiler'
import type { Node, Edge } from '@xyflow/react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<Node> & { id: string; type: string }): Node {
  return {
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  }
}

function makeEdge(source: string, target: string, sourceHandle?: string): Edge {
  return {
    id: `${source}-${target}${sourceHandle ? `-${sourceHandle}` : ''}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('compileToLua', () => {
  // ── Empty / no triggers ──────────────────────────────────────────────────
  it('returns comment when no trigger nodes exist', () => {
    const result = compileToLua([], [])
    expect(result).toContain('No trigger')
  })

  it('returns comment when only non-trigger nodes exist', () => {
    const nodes: Node[] = [
      makeNode({ id: 'if-1', type: 'If', data: { variable: 'x', operator: '>', comparisonData: { mode: 'value', value: '10' } } }),
    ]
    const result = compileToLua(nodes, [])
    expect(result).toContain('No trigger')
  })

  // ── OnSolReceived trigger ────────────────────────────────────────────────

  describe('OnSolReceived trigger', () => {
    it('generates a standalone trigger with no actions', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
      ]

      const lua = compileToLua(nodes, [])
      expect(lua).toContain('function on_sol_received(amount, sender)')
      expect(lua).toContain('-- no actions')
      expect(lua).toContain('end')
    })

    it('uses custom function name when provided', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { customName: 'handle_sol', assignedVariable: 'amt', assignedSender: 'src' },
        }),
      ]

      const lua = compileToLua(nodes, [])
      expect(lua).toContain('function handle_sol(amt, src)')
    })
  })

  // ── OnUSDCReceived trigger ───────────────────────────────────────────────

  describe('OnUSDCReceived trigger', () => {
    it('generates a standalone trigger with no actions', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'usdc-1',
          type: 'OnUSDCReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
      ]

      const lua = compileToLua(nodes, [])
      expect(lua).toContain('function on_usdc_received(amount, sender)')
    })
  })

  // ── Trigger → Transfer chain ────────────────────────────────────────────

  describe('trigger → Transfer chain', () => {
    it('generates Transfer action inside trigger body', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
        makeNode({
          id: 'tx-1',
          type: 'Transfer',
          data: {
            recipientData: { mode: 'variable', value: 'sender' },
            amountData: { mode: 'value', value: '100' },
            token: 'SOL',
          },
        }),
      ]
      const edges: Edge[] = [makeEdge('sol-1', 'tx-1')]

      const lua = compileToLua(nodes, edges)
      expect(lua).toContain('transferSol(sender, 100)')
    })
  })

  // ── Trigger → If branching ──────────────────────────────────────────────

  describe('trigger → If branching', () => {
    it('generates if/else with true and false branches', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
        makeNode({
          id: 'if-1',
          type: 'If',
          data: { variable: 'amount', operator: '>', comparisonData: { mode: 'value', value: '100' } },
        }),
        makeNode({
          id: 'tx-true',
          type: 'Transfer',
          data: {
            recipientData: { mode: 'value', value: '0xABC' },
            amountData: { mode: 'variable', value: 'amount' },
            token: 'SOL',
          },
        }),
        makeNode({
          id: 'tx-false',
          type: 'TransferToken',
          data: {
            tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC address
            recipientData: { mode: 'value', value: '0xDEF' },
            amountData: { mode: 'value', value: '50' },
          },
        }),
      ]
      const edges: Edge[] = [
        makeEdge('sol-1', 'if-1'),
        makeEdge('if-1', 'tx-true', 'true'),
        makeEdge('if-1', 'tx-false', 'false'),
      ]

      const lua = compileToLua(nodes, edges)
      expect(lua).toContain('if amount > 100 then')
      expect(lua).toContain('transferSol("0xABC", amount)')
      expect(lua).toContain('else')
      expect(lua).toContain('transferToken("0xDEF", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 50)')
    })
  })

  // ── Trigger → Loop ──────────────────────────────────────────────────────

  describe('trigger → Loop', () => {
    it('generates for-loop with body and continuation', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
        makeNode({
          id: 'loop-1',
          type: 'Loop',
          data: { iterations: '3' },
        }),
        makeNode({
          id: 'tx-loop',
          type: 'Transfer',
          data: {
            recipientData: { mode: 'variable', value: 'sender' },
            amountData: { mode: 'value', value: '10' },
            token: 'SOL',
          },
        }),
      ]
      const edges: Edge[] = [
        makeEdge('sol-1', 'loop-1'),
        makeEdge('loop-1', 'tx-loop', 'loop'),
      ]

      const lua = compileToLua(nodes, edges)
      expect(lua).toContain('for i=1, 3 do')
      expect(lua).toContain('transferSol(sender, 10)')
    })
  })

  // ── Trigger → GetSolBalance → Compute ───────────────────────────────────

  describe('trigger → GetSolBalance → Compute chain', () => {
    it('generates balance query followed by computation', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
        makeNode({
          id: 'bal-1',
          type: 'GetSolBalance',
          data: { balanceAmount: 'myBalance' },
        }),
        makeNode({
          id: 'calc-1',
          type: 'Compute',
          data: {
            op1Data: { mode: 'variable', value: 'myBalance' },
            op2Data: { mode: 'value', value: '2' },
            operator: '*',
            assignedVariable: 'doubled',
          },
        }),
      ]
      const edges: Edge[] = [
        makeEdge('sol-1', 'bal-1'),
        makeEdge('bal-1', 'calc-1'),
      ]

      const lua = compileToLua(nodes, edges)
      expect(lua).toContain('myBalance = getBalance(my_address)')
      expect(lua).toContain('local doubled = myBalance * 2')
    })
  })

  // ── Multiple triggers ───────────────────────────────────────────────────

  describe('multiple triggers', () => {
    it('generates separate functions for each trigger', () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amt1', assignedSender: 'src1' },
        }),
        makeNode({
          id: 'usdc-1',
          type: 'OnUSDCReceived',
          data: { assignedVariable: 'amt2', assignedSender: 'src2' },
        }),
      ]

      const lua = compileToLua(nodes, [])
      expect(lua).toContain('function on_sol_received(amt1, src1)')
      expect(lua).toContain('function on_usdc_received(amt2, src2)')
    })
  })

  describe("trigger -> OnSolReceived -> Compute -> Transfer", () => {
    it("generates a chain of trigger, compute, and transfer", () => {
      const nodes: Node[] = [
        makeNode({
          id: 'sol-1',
          type: 'OnSolReceived',
          data: { assignedVariable: 'amount', assignedSender: 'sender' },
        }),
        makeNode({
          id: 'compute-1',
          type: 'Compute',
          data: {
            op1Data: { mode: 'variable', value: 'amount' },
            op2Data: { mode: 'value', value: '0.001' },
            operator: '-',
            assignedVariable: 'amount_to_sent',
          },
        }),
        makeNode({
          id: 'transfer-1',
          type: 'Transfer',
          data: {
            recipientData: { mode: 'variable', value: 'sender' },
            amountData: { mode: 'variable', value: 'amount_to_sent' },
            token: 'SOL',
          },
        }),
      ]
      const edges: Edge[] = [
        makeEdge('sol-1', 'compute-1'),
        makeEdge('compute-1', 'transfer-1'),
      ]

      const lua = compileToLua(nodes, edges)
      expect(lua).toContain('function on_sol_received(amount, sender)')
      expect(lua).toContain('local amount_to_sent = amount - 0.001')
      expect(lua).toContain('transferSol(sender, amount_to_sent)')
    })
  })
})
