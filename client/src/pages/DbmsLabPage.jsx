import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Play,
  Layers,
  GitBranch,
  Edit3,
  RotateCcw,
  CheckCircle2,
  Terminal,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRESET_QUERIES = [
  {
    id: 'LOOKUP_CLAIMS_USERS_ITEMS',
    label: 'Relational Join: Claims, Users and FoundItems',
    badge: '$lookup',
    desc: 'Joins claims with user and foundItem documents in a single aggregation pipeline.',
  },
  {
    id: 'LOOKUP_MATCH_CANDIDATES',
    label: 'Relational Join: MatchCandidates, LostReports and FoundItems',
    badge: 'N:M Join',
    desc: 'Joins candidate pairs with their corresponding lostReport and foundItem documents.',
  },
  {
    id: 'EXPLAIN_COMPOUND_INDEX',
    label: 'Index Execution Plan: Compound Index Performance',
    badge: 'explainStats',
    desc: 'Runs explain("executionStats") on foundItems compound index and reports keys and documents examined.',
  },
  {
    id: 'TEXT_INDEX_SEARCH',
    label: 'Full Text Search with Relevance Score',
    badge: '$text Index',
    desc: 'Executes weighted full text search across itemName, brand, and description.',
  },
  {
    id: 'AGG_RETENTION_AGING',
    label: 'Aggregation: Retention Class and Unit Totals',
    badge: '$group',
    desc: 'Groups inventory by retentionClass and status, summing document counts and batch quantities.',
  },
  {
    id: 'AGG_CAMPUS_HOTSPOTS',
    label: 'Aggregation: Campus Zone Recovery Metrics',
    badge: '$cond + $group',
    desc: 'Computes found, returned, and active storage counts per campus building zone.',
  },
];

export default function DbmsLabPage() {
  const { showToast, refreshBootstrap } = useAuth();
  const [overview, setOverview] = useState(null);
  const [activePresetResult, setActivePresetResult] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState('foundItems');
  const [filterInput, setFilterInput] = useState('{}');
  const [collectionDocs, setCollectionDocs] = useState([]);
  const [collectionExplain, setCollectionExplain] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingJsonText, setEditingJsonText] = useState('');
  const [constraintResult, setConstraintResult] = useState(null);

  const loadLabOverview = useCallback(async () => {
    try {
      const res = await apiRequest('/dbms-lab/overview');
      setOverview(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadCollectionDocuments = useCallback(
    async (colName = selectedCollection, filterStr = filterInput) => {
      try {
        const res = await apiRequest(
          `/dbms-lab/collection/${colName}?filterJson=${encodeURIComponent(filterStr)}`
        );
        setCollectionDocs(res.data.documents || []);
        setCollectionExplain(res.data.explainSummary || null);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    [selectedCollection, filterInput, showToast]
  );

  useEffect(() => {
    loadLabOverview();
    loadCollectionDocuments('foundItems', '{}');
  }, [loadLabOverview]);

  const handleRunPreset = async (presetId) => {
    try {
      const res = await apiRequest('/dbms-lab/run-preset', {
        method: 'POST',
        body: JSON.stringify({ presetId }),
      });
      setActivePresetResult(res.data);
      showToast(`Executed query in ${res.data.durationMs}ms`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveDocumentEdit = async () => {
    if (!editingDoc) return;
    try {
      const parsed = JSON.parse(editingJsonText);
      await apiRequest(`/dbms-lab/collection/${selectedCollection}/${editingDoc._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ updates: parsed }),
      });
      setEditingDoc(null);
      showToast(`Updated document in ${selectedCollection}`);
      loadCollectionDocuments(selectedCollection, filterInput);
      loadLabOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTestConstraint = async (testType) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
        : '/api';
      const res = await fetch(`${apiBase}/dbms-lab/test-constraint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('vaulttrace_token') || ''}`,
        },
        body: JSON.stringify({ testType }),
      });
      const data = await res.json();
      setConstraintResult(data);
      showToast('Constraint check executed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetDemoDatabase = async () => {
    try {
      await apiRequest('/dbms-lab/reseed', { method: 'POST' });
      await refreshBootstrap();
      await loadLabOverview();
      await loadCollectionDocuments(selectedCollection, '{}');
      showToast('Database reset to clean initial dataset');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="bg-[#ECEAE3] rounded-[28px] p-6 sm:p-8 border border-[#DFDDD4] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DDE2DC] text-[#2C372F] text-xs font-semibold">
            <Database className="w-3.5 h-3.5" />
            <span>Database Management Lab</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1F2621]">
            MongoDB Schema, Query Plans and Live Document Editor
          </h1>
          <p className="text-xs text-[#58605A] max-w-3xl">
            Engine: <strong className="font-mono text-[#1F2621]">{overview?.dbMode}</strong> /
            Database: <strong className="font-mono text-[#1F2621]">{overview?.databaseName}</strong>.
            Run aggregation pipelines, inspect index execution stats, and modify collection records directly.
          </p>
        </div>

        <button
          onClick={handleResetDemoDatabase}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset and Reseed Database</span>
        </button>
      </div>

      {/* Section 1: Collections */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#2C372F]" />
          <span>1. Collections and Indexes ({overview?.collections?.length || 0})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {overview?.collections?.map((col) => (
            <button
              key={col.collectionName}
              onClick={() => {
                setSelectedCollection(col.collectionName);
                setFilterInput('{}');
                loadCollectionDocuments(col.collectionName, '{}');
              }}
              className={`text-left p-4 rounded-2xl border transition ${
                selectedCollection === col.collectionName
                  ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                  : 'bg-[#ECEAE3] text-[#1F2621] border-[#DFDDD4] hover:bg-[#E2E0D6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm">{col.collectionName}</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    selectedCollection === col.collectionName
                      ? 'bg-[#F7F6F2] text-[#1F2621]'
                      : 'bg-[#F7F6F2] text-[#353D37]'
                  }`}
                >
                  {col.documentCount}
                </span>
              </div>
              <div
                className={`mt-2 text-[11px] space-y-1 ${
                  selectedCollection === col.collectionName ? 'text-[#C8D3C9]' : 'text-[#606861]'
                }`}
              >
                <div>Indexes ({col.indexes?.length}):</div>
                {col.indexes?.slice(0, 3).map((idx, i) => (
                  <div key={i} className="font-mono text-[10px] truncate">
                    {idx.name} {idx.unique ? '[UNIQUE]' : ''}
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section 2: Preset Queries */}
      <section className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#2C372F]" />
            <span>2. Aggregation Pipelines, Lookups and Execution Plans</span>
          </h2>
          <p className="text-xs text-[#606861]">
            Select any query below to run the MongoDB pipeline and view the equivalent mongosh syntax and output.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESET_QUERIES.map((q) => (
            <button
              key={q.id}
              onClick={() => handleRunPreset(q.id)}
              className="text-left p-4 rounded-2xl bg-[#F7F6F2] border border-[#DFDDD4] hover:border-[#2C372F] transition flex flex-col justify-between gap-2 group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#DDE2DC] text-[#2C372F]">
                    {q.badge}
                  </span>
                  <Play className="w-4 h-4 text-[#2C372F]" />
                </div>
                <div className="font-bold text-[#1F2621] text-xs sm:text-sm">{q.label}</div>
                <p className="text-[11px] text-[#606861] mt-1">{q.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {activePresetResult && (
          <div className="rounded-2xl bg-[#2C372F] text-[#F7F6F2] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#425046] pb-3">
              <div>
                <span className="text-xs font-bold text-[#DDE6DF]">{activePresetResult.title}</span>
                <div className="text-[11px] text-[#C8D3C9] font-mono">
                  Returned {activePresetResult.resultCount} document(s) in{' '}
                  {activePresetResult.durationMs}ms
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase text-[#C8D3C9] mb-1">
                Equivalent mongosh Query
              </div>
              <pre className="bg-[#1F2621] text-[#DDE6DF] p-3.5 rounded-xl text-xs overflow-x-auto">
                {activePresetResult.mongoshEquivalent}
              </pre>
            </div>

            {activePresetResult.explainStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { label: 'Winning Stage', val: activePresetResult.explainStats.winningPlanStage },
                  { label: 'Index Used', val: activePresetResult.explainStats.indexUsed },
                  { label: 'Keys Examined', val: activePresetResult.explainStats.totalKeysExamined },
                  { label: 'Docs Examined', val: activePresetResult.explainStats.totalDocsExamined },
                  { label: 'Execution Time', val: `${activePresetResult.explainStats.executionTimeMillis} ms` },
                ].map((st, idx) => (
                  <div key={idx} className="bg-[#1F2621] rounded-xl p-3 text-xs">
                    <div className="text-[#C8D3C9] text-[10px]">{st.label}</div>
                    <div className="font-mono font-bold text-[#F7F6F2] truncate">{st.val}</div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="text-[11px] font-mono uppercase text-[#C8D3C9] mb-1">
                Query Result
              </div>
              <pre className="bg-[#1F2621] text-[#F7F6F2] p-3.5 rounded-xl text-xs max-h-80 overflow-y-auto">
                {JSON.stringify(activePresetResult.results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Live Document Editor */}
      <section className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[#2C372F]" />
              <span>
                3. Live Collection Browser and Document Editor ({selectedCollection})
              </span>
            </h2>
            <p className="text-xs text-[#606861]">
              Filter documents with JSON queries or edit any document directly.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder='{"status": "Stored"}'
              className="w-64 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2 text-xs font-mono"
            />
            <button
              onClick={() => loadCollectionDocuments(selectedCollection, filterInput)}
              className="px-5 py-2 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621]"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {collectionExplain && (
          <div className="bg-[#F7F6F2] border border-[#DFDDD4] rounded-2xl px-4 py-2.5 text-xs flex flex-wrap items-center gap-4 font-mono text-[#353D37]">
            <span className="font-bold text-[#1F2621]">Execution Stats:</span>
            <span>Stage: <strong>{collectionExplain.winningStage}</strong></span>
            <span>Returned: <strong>{collectionExplain.nReturned}</strong></span>
            <span>Keys Examined: <strong>{collectionExplain.totalKeysExamined}</strong></span>
            <span>Docs Examined: <strong>{collectionExplain.totalDocsExamined}</strong></span>
            <span>Time: <strong>{collectionExplain.executionTimeMillis}ms</strong></span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1">
          {collectionDocs.map((doc) => (
            <div
              key={doc._id}
              className="rounded-2xl border border-[#DFDDD4] bg-[#F7F6F2] p-4 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#DFDDD4] pb-2">
                <span className="font-mono text-xs font-bold text-[#1F2621]">
                  _id: {doc._id}
                </span>
                <button
                  onClick={() => {
                    setEditingDoc(doc);
                    const editableCopy = { ...doc };
                    delete editableCopy._id;
                    delete editableCopy.__v;
                    setEditingJsonText(JSON.stringify(editableCopy, null, 2));
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Document</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-[#353D37] overflow-x-auto max-h-48">
                {JSON.stringify(doc, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Constraint Proof */}
      <section className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#2C372F]" />
            <span>4. Schema Validation and Constraint Verification</span>
          </h2>
          <p className="text-xs text-[#606861]">
            Trigger database constraint checks to demonstrate unique index and enum validation enforcement.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleTestConstraint('DUPLICATE_ITEM_CODE')}
            className="px-4 py-2.5 rounded-full bg-[#FBFBF9] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold transition"
          >
            Test Duplicate foundItems.itemCode
          </button>
          <button
            onClick={() => handleTestConstraint('INVALID_ENUM_CATEGORY')}
            className="px-4 py-2.5 rounded-full bg-[#FBFBF9] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold transition"
          >
            Test Invalid Category Enum
          </button>
          <button
            onClick={() => handleTestConstraint('DUPLICATE_MATCH_PAIR')}
            className="px-4 py-2.5 rounded-full bg-[#FBFBF9] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold transition"
          >
            Test Duplicate Candidate Match Pair
          </button>
        </div>

        {constraintResult && (
          <div className="rounded-2xl bg-[#2C372F] text-[#F7F6F2] p-4 font-mono text-xs space-y-1">
            <div className="text-[#DDE6DF] font-bold">
              Constraint Enforced ({constraintResult.errorType})
            </div>
            <div className="text-[#C8D3C9]">{constraintResult.message}</div>
          </div>
        )}
      </section>

      {/* Section 5: Logical ER Relationship Table */}
      <section className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[#2C372F]" />
          <span>5. Logical Entity Relationship Matrix</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#E2E0D6] text-[#353D37] uppercase text-[11px]">
                <th className="py-3 px-4">Parent Collection</th>
                <th className="py-3 px-4">Target Collection</th>
                <th className="py-3 px-4">Cardinality</th>
                <th className="py-3 px-4">Reference / Constraint</th>
                <th className="py-3 px-4">Design Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFDDD4]">
              {overview?.erRelationships?.map((rel, i) => (
                <tr key={i} className="hover:bg-[#F7F6F2]/60">
                  <td className="py-3 px-4 font-mono font-bold text-[#1F2621]">{rel.from}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#2C372F]">
                    {rel.via ? `${rel.to} (via ${rel.via})` : rel.to}
                  </td>
                  <td className="py-3 px-4 font-bold">{rel.cardinality}</td>
                  <td className="py-3 px-4 font-mono text-[#353D37]">{rel.field}</td>
                  <td className="py-3 px-4 text-[#58605A]">{rel.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Document Editor Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1F2621]">
                  Edit Document ({selectedCollection})
                </h3>
                <p className="text-xs text-[#606861] font-mono">_id: {editingDoc._id}</p>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="px-4 py-1.5 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <textarea
              rows={14}
              value={editingJsonText}
              onChange={(e) => setEditingJsonText(e.target.value)}
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#1F2621] text-[#DDE6DF] p-4 font-mono text-xs focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#606861]">
                Validated by Mongoose schema and recorded in auditLogs.
              </span>
              <button
                onClick={handleSaveDocumentEdit}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
