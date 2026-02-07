import React from 'react'

type Props = React.PropsWithChildren<{ title: string }>

export default function Card({ title, children }: Props) {
  return (
    <section className="card-gradient rounded-2xl shadow-2xl p-4 border border-transparent text-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
