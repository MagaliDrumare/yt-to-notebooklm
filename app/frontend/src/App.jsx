import { useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(20)
  const [months, setMonths] = useState(6)
  const [noDateFilter, setNoDateFilter] = useState(false)
  const [videos, setVideos] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [notebookName, setNotebookName] = useState('')
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [result, setResult] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setVideos([])
    setSelected(new Set())
    setResult(null)
    setSearchError('')
    setNotebookName(query.trim())

    try {
      const res = await fetch(`${API}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count, months, no_date_filter: noDateFilter }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Search failed')
      }
      const data = await res.json()
      setVideos(data)
      setSelected(new Set(data.map((_, i) => i)))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleCreateNotebook() {
    const urls = videos.filter((_, i) => selected.has(i)).map(v => v.url)
    if (!urls.length || !notebookName.trim()) return
    setCreating(true)
    setResult(null)

    try {
      const res = await fetch(`${API}/api/notebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: notebookName, urls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setCreating(false)
    }
  }

  function toggleSelect(i) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === videos.length) setSelected(new Set())
    else setSelected(new Set(videos.map((_, i) => i)))
  }

  function fmtViews(n) {
    if (!n) return 'N/A'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo-row">
            <span className="logo-icon">▶</span>
            <span className="logo-text">YT → NotebookLM</span>
          </div>
          <p className="subtitle">Search YouTube · Select videos · Create a NotebookLM notebook</p>
        </div>
      </header>

      <main className="main">
        <section className="card search-card">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-row">
              <input
                className="search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search YouTube… e.g. Claude Code skills"
                disabled={searching}
              />
              <button className="btn btn-primary" type="submit" disabled={searching || !query.trim()}>
                {searching ? <span className="spinner" /> : '🔍 Search'}
              </button>
            </div>
            <div className="options-row">
              <label className="option">
                <span>Results</span>
                <select value={count} onChange={e => setCount(+e.target.value)} disabled={searching}>
                  {[5, 10, 20, 50].map(n => <option key={n}>{n}</option>)}
                </select>
              </label>
              <label className="option">
                <span>Period</span>
                <select value={months} onChange={e => setMonths(+e.target.value)} disabled={searching || noDateFilter}>
                  <option value={1}>1 month</option>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>1 year</option>
                </select>
              </label>
              <label className="option checkbox">
                <input type="checkbox" checked={noDateFilter} onChange={e => setNoDateFilter(e.target.checked)} />
                <span>All time</span>
              </label>
            </div>
          </form>
        </section>

        {searchError && <div className="banner error-banner">⚠ {searchError}</div>}

        {videos.length > 0 && (
          <section className="card results-card">
            <div className="results-header">
              <span className="results-count">{videos.length} videos · sorted by most viewed ↓</span>
              <button className="btn btn-ghost" onClick={toggleAll}>
                {selected.size === videos.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="video-list">
              {videos.map((v, i) => (
                <div
                  key={i}
                  className={`video-row ${selected.has(i) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(i)}
                >
                  <div className={`check-box ${selected.has(i) ? 'checked' : ''}`}>
                    {selected.has(i) && '✓'}
                  </div>
                  <div className="video-info">
                    <a
                      className="video-title"
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="rank">#{i + 1}</span> {v.title}
                    </a>
                    <div className="video-meta">
                      <span className="meta-channel">{v.channel}</span>
                      <span className="dot">·</span>
                      <span className="views-highlight">👁 {fmtViews(v.views)}</span>
                      <span className="dot">·</span>
                      <span>{v.duration}</span>
                      <span className="dot">·</span>
                      <span>{v.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="notebook-bar">
              <input
                className="notebook-input"
                value={notebookName}
                onChange={e => setNotebookName(e.target.value)}
                placeholder="Notebook name"
              />
              <span className="badge">{selected.size} selected</span>
              <button
                className="btn btn-success"
                onClick={handleCreateNotebook}
                disabled={creating || selected.size === 0 || !notebookName.trim()}
              >
                {creating ? <span className="spinner" /> : '📓 Create Notebook'}
              </button>
            </div>

            {result && !result.error && (
              <div className="banner success-banner">
                ✅ Notebook <strong>"{result.name}"</strong> created — {result.added} sources added
                {result.failed > 0 && `, ${result.failed} failed`}.
              </div>
            )}
            {result?.error && <div className="banner error-banner">⚠ {result.error}</div>}
          </section>
        )}
      </main>
    </div>
  )
}
