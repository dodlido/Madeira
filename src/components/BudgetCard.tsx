import React, { useState } from 'react'
import Card from './Card'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUI } from '../context/UIContext'

type Item = { id: string; desc: string; amount: number }

export default function BudgetCard() {
  const [items, setItems] = useLocalStorage<Item[]>('budget', [])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const { showAdd } = useUI()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const editDescRef = React.useRef<HTMLInputElement | null>(null)

  function add(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!desc || Number.isNaN(n)) return
    setItems([...items, { id: String(Date.now()), desc, amount: n }])
    setDesc('')
    setAmount('')
  }

  function startEdit(it: Item) {
    // initialize controlled edit fields immediately so inputs show current values
    setEditDesc(it.desc)
    setEditAmount(String(it.amount))
    setEditingId(it.id)
    setTimeout(() => editDescRef.current?.focus(), 0)
  }

  React.useEffect(() => {
    if (!editingId) return
    const orig = items.find(i => i.id === editingId)
    if (orig) {
      setEditDesc(orig.desc)
      setEditAmount(String(orig.amount))
      // focus the first field next tick
      setTimeout(() => editDescRef.current?.focus(), 0)
    }
  }, [editingId, items])

  function saveEdit() {
    if (!editingId) return
    const original = items.find(i => i.id === editingId)
    if (!original) return
    const finalDesc = editDesc && editDesc.trim() ? editDesc : original.desc
    const n = editAmount && editAmount.trim() ? parseFloat(editAmount) : original.amount
    if (Number.isNaN(n) || !finalDesc) return
    setItems(items.map(it => it.id === editingId ? { ...it, desc: finalDesc, amount: n } : it))
    setEditingId(null)
    setEditDesc('')
    setEditAmount('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDesc('')
    setEditAmount('')
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id))
  }

  const total = items.reduce((s, it) => s + it.amount, 0)

  return (
    <Card title="Budget">
      {showAdd && (
        <form onSubmit={add} className="space-y-2">
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="flex gap-2">
            <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Add</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={() => setItems([])}>Clear</button>
          </div>
        </form>
      )}

      <div className="mt-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="font-medium text-white">Total: {total.toFixed(2)} €</div>
          <div>
            <button className="px-3 py-1 rounded border" onClick={() => setItems([])}>Clear All</button>
          </div>
        </div>
        <ul className="mt-2 space-y-2">
          {items.length === 0 && <li className="text-teal-600">No budget items.</li>}
          {items.map(it => (
            <li key={it.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border rounded p-2 bg-gray-50">
              {editingId === it.id ? (
                <div className="w-full sm:flex-1">
                  <input ref={editDescRef} className="w-full border rounded px-2 py-1 mb-2 text-gray-900" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                  <input className="w-full border rounded px-2 py-1 text-gray-900" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                </div>
              ) : (
                <div className="w-full sm:flex-1">
                  <span className="text-teal-600">{it.desc}</span>
                </div>
              )}

              <div className="mt-2 sm:mt-0 flex items-center gap-2">
                {editingId === it.id ? (
                  <>
                    <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={saveEdit}>Save</button>
                    <button className="px-3 py-1 rounded border text-teal-700" onClick={cancelEdit}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="font-medium text-teal-300 mr-2">{it.amount.toFixed(2)} €</div>
                    <button className="px-2 py-1 rounded border border-teal-200 text-teal-700" onClick={() => startEdit(it)}>Edit</button>
                        <button className="px-2 py-1 rounded border border-red-200 text-red-600" onClick={() => removeItem(it.id)}>Remove</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
