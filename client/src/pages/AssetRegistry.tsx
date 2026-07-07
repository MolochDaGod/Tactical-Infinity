import { useState } from "react";
import { ALL_WEAPON_MODELS, WEAPON_MODELS_BY_CATEGORY, GOLDMINE_MODELS, PROP_MODELS, STRUCTURE_MODELS, type WeaponModelCategory } from "@/data/weaponModels";
import { resourceNodeTemplates } from "@/lib/resourceNodes";

const CATEGORY_META: Record<WeaponModelCategory, { label: string; icon: string; color: string }> = {
  sword:       { label: "Swords",         icon: "⚔️",  color: "from-blue-900/60 to-blue-800/40" },
  axe_1h:      { label: "Axes (1H)",      icon: "🪓",  color: "from-red-900/60 to-red-800/40" },
  axe_2h:      { label: "Greataxes (2H)", icon: "🪓",  color: "from-red-800/60 to-orange-800/40" },
  hammer_2h:   { label: "Warhammers",     icon: "🔨",  color: "from-orange-900/60 to-yellow-900/40" },
  bow:         { label: "Bows",           icon: "🏹",  color: "from-green-900/60 to-green-800/40" },
  crossbow:    { label: "Crossbows",      icon: "🏹",  color: "from-teal-900/60 to-teal-800/40" },
  polearm:     { label: "Polearms",       icon: "🗡️",  color: "from-purple-900/60 to-purple-800/40" },
  magic_staff: { label: "Magic Staves",   icon: "🪄",  color: "from-violet-900/60 to-indigo-800/40" }
};

const ZONE_COLORS: Record<string, string> = {
  inner: "bg-blue-900/60 text-blue-300",
  mid:   "bg-green-900/60 text-green-300",
  outer: "bg-orange-900/60 text-orange-300"
};

const GEOMETRY_ICONS: Record<string, string> = {
  tree: "🌳", rock: "🪨", ore: "💎", plant: "🌿", animal: "🦌"
};

type Tab = "weapons" | "harvestables" | "buildings";

export default function AssetRegistry() {
  const [tab, setTab] = useState<Tab>("weapons");
  const [selectedCategory, setSelectedCategory] = useState<WeaponModelCategory>("sword");
  const [tierFilter, setTierFilter] = useState<number | null>(null);

  const categories = Object.keys(WEAPON_MODELS_BY_CATEGORY) as WeaponModelCategory[];
  const models = WEAPON_MODELS_BY_CATEGORY[selectedCategory].filter(
    m => tierFilter === null || m.tier === tierFilter
  );

  const harvestTemplates = Object.entries(resourceNodeTemplates);
  const nodesByZone = {
    inner: harvestTemplates.filter(([, t]) => t.spawnZone === 'inner'),
    mid:   harvestTemplates.filter(([, t]) => t.spawnZone === 'mid'),
    outer: harvestTemplates.filter(([, t]) => t.spawnZone === 'outer')
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
            Asset Registry
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {ALL_WEAPON_MODELS.length} weapon models · {Object.keys(resourceNodeTemplates).length} harvestable node types
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {(["weapons", "harvestables", "buildings"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`tab-${t}`}
              className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-colors
                ${tab === t ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "weapons" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => {
                const meta = CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    data-testid={`weapon-cat-${cat}`}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors border
                      ${selectedCategory === cat
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="text-xs opacity-60 ml-1">{WEAPON_MODELS_BY_CATEGORY[cat].length}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <span className="text-gray-400 text-sm">Tier:</span>
              <button
                onClick={() => setTierFilter(null)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors
                  ${tierFilter === null ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >All</button>
              {[1,2,3,4,5,6,7,8].map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors
                    ${tierFilter === t ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >T{t}</button>
              ))}
            </div>

            <div className="mb-2 text-sm text-gray-400">
              Showing {models.length} models — {CATEGORY_META[selectedCategory].label}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {models.map(m => (
                <div
                  key={m.id}
                  data-testid={`weapon-card-${m.id}`}
                  className={`bg-gradient-to-br ${CATEGORY_META[m.category].color} border border-gray-700/50
                    rounded-xl p-3 flex flex-col gap-1.5 hover:border-amber-600/50 transition-colors`}
                >
                  <div className="text-2xl text-center">{CATEGORY_META[m.category].icon}</div>
                  <div className="text-xs font-semibold text-gray-200 text-center leading-tight">{m.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded font-mono">T{m.tier}</span>
                    <span className="text-xs text-gray-500">{m.handedness}</span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate">{m.modelPath.split('/').pop()}</div>
                  {m.ranged && <span className="text-xs bg-green-900/40 text-green-400 px-1 rounded self-start">Ranged</span>}
                  {m.magical && <span className="text-xs bg-violet-900/40 text-violet-400 px-1 rounded self-start">Magical</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "harvestables" && (
          <div>
            <div className="mb-3 text-sm text-gray-400">
              {Object.keys(resourceNodeTemplates).length} harvestable node types across 3 island zones
            </div>

            {(["inner", "mid", "outer"] as const).map(zone => {
              const nodes = nodesByZone[zone];
              const zoneLabels = { inner: "🏠 Inner — Town Zone", mid: "🌳 Mid — Harvesting Zone", outer: "⛰️ Outer — Wilderness Zone" };
              return (
                <div key={zone} className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-300 mb-3">{zoneLabels[zone]}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {nodes.map(([key, t]) => (
                      <div
                        key={key}
                        data-testid={`node-card-${key}`}
                        className="bg-gray-900 border border-gray-700/60 rounded-xl p-3 flex flex-col gap-1.5
                          hover:border-amber-600/40 transition-colors"
                      >
                        <div className="text-2xl text-center">{GEOMETRY_ICONS[t.fallbackGeometry] ?? '📦'}</div>
                        <div className="text-xs font-semibold text-gray-200 text-center leading-tight">{t.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ZONE_COLORS[t.spawnZone]}`}>{t.spawnZone}</span>
                          <span className="text-xs bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded font-mono">T{t.tier}</span>
                        </div>
                        <div className="text-xs text-gray-500">{t.profession}</div>
                        <div className="text-xs text-gray-600">
                          Yield: {t.yieldMin}–{t.yieldMax} · HP: {t.health}
                        </div>
                        {t.fbxModelUrl && (
                          <span className="text-xs bg-orange-900/40 text-orange-400 px-1 rounded self-start">FBX</span>
                        )}
                        {t.modelUrl && !t.fbxModelUrl && (
                          <span className="text-xs bg-blue-900/40 text-blue-400 px-1 rounded self-start">GLB</span>
                        )}
                        <div className="text-xs text-gray-700 font-mono truncate">
                          {(t.fbxModelUrl ?? t.modelUrl ?? '—').split('/').pop()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "buildings" && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                ⛏️ Goldmine Pack ({Object.keys(GOLDMINE_MODELS).length} models)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(GOLDMINE_MODELS).map(([key, path]) => (
                  <div
                    key={key}
                    data-testid={`building-goldmine-${key}`}
                    className="bg-gradient-to-br from-yellow-900/40 to-amber-900/20 border border-yellow-700/30
                      rounded-xl p-3 flex flex-col gap-1 hover:border-amber-500/50 transition-colors"
                  >
                    <div className="text-2xl text-center">
                      {key.startsWith('crystal') ? '💎' : key.startsWith('gold') ? '🥇' : key.startsWith('stone') ? '🪨' : '⛏️'}
                    </div>
                    <div className="text-xs font-semibold text-gray-200 text-center leading-tight">{key.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-600 font-mono truncate">{path.split('/').pop()}</div>
                    <span className="text-xs bg-orange-900/40 text-orange-400 px-1 rounded self-start">FBX</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                🏺 Props ({Object.keys(PROP_MODELS).length} models)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(PROP_MODELS).map(([key, path]) => (
                  <div
                    key={key}
                    data-testid={`building-prop-${key}`}
                    className="bg-gradient-to-br from-gray-800/80 to-gray-900/60 border border-gray-700/40
                      rounded-xl p-3 flex flex-col gap-1 hover:border-amber-600/40 transition-colors"
                  >
                    <div className="text-2xl text-center">
                      {key.includes('barrel') ? '🛢️' : key.includes('torch') ? '🔥' : key.includes('chair') || key.includes('throne') ? '🪑' : '📦'}
                    </div>
                    <div className="text-xs font-semibold text-gray-200 text-center leading-tight">{key.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-600 font-mono truncate">{path.split('/').pop()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                🏰 Structures ({Object.keys(STRUCTURE_MODELS).length} models)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(STRUCTURE_MODELS).map(([key, path]) => (
                  <div
                    key={key}
                    data-testid={`building-structure-${key}`}
                    className="bg-gradient-to-br from-stone-800/80 to-stone-900/60 border border-stone-700/40
                      rounded-xl p-3 flex flex-col gap-1 hover:border-amber-600/40 transition-colors"
                  >
                    <div className="text-2xl text-center">
                      {key.includes('gate') ? '🚪' : key.includes('bridge') ? '🌉' : key.includes('fence') ? '🚧' : key.includes('cart') ? '🛒' : '🏗️'}
                    </div>
                    <div className="text-xs font-semibold text-gray-200 text-center leading-tight">{key.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-600 font-mono truncate">{path.split('/').pop()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
