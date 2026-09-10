import { useParams } from 'react-router-dom'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <h1 className="p-8 text-2xl font-bold text-slate-800">ProjectDetailPage {id}</h1>
}
