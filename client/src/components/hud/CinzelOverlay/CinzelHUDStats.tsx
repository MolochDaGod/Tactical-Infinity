import type { PlayerHudState } from './types';

interface Props {
  state:       PlayerHudState;
  onPortraitClick?: () => void;
}

function pct(b: { current: number; max: number }) {
  if (b.max <= 0) return 0;
  return Math.max(0, Math.min(100, (b.current / b.max) * 100));
}

export function CinzelHUDStats({ state, onPortraitClick }: Props) {
  return (
    <div className="ui-element panel-style status-card" data-testid="cinzel-status-card">
      <div className="status-bars">
        <div
          className="hud-portrait"
          onClick={onPortraitClick}
          title={`${state.name} — open character`}
          data-testid="hud-portrait"
        >
          {state.portraitUrl
            ? <img src={state.portraitUrl} alt={state.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
            : <span>{state.portraitGlyph}</span>}
        </div>
        <div className="bar-track hp" title={`HP ${state.hp.current}/${state.hp.max}`}>
          <div className="bar-fill hp" style={{ width: `${pct(state.hp)}%` }} data-testid="bar-hp" />
        </div>
        <div className="bar-track mp" title={`MP ${state.mp.current}/${state.mp.max}`}>
          <div className="bar-fill mp" style={{ width: `${pct(state.mp)}%` }} data-testid="bar-mp" />
        </div>
        <div className="bar-track sp" title={`SP ${state.sp.current}/${state.sp.max}`}>
          <div className="bar-fill sp" style={{ width: `${pct(state.sp)}%` }} data-testid="bar-sp" />
        </div>
      </div>

      <div className="status-info">
        <div className="hud-name" data-testid="text-hud-name">{state.name}</div>
        <div className="hud-class" data-testid="text-hud-class">{state.classLine}</div>
        <div className="hud-divider" />
        <div className="hud-equipped-label">Equipped</div>
        <div className="hud-gear">
          {state.equipped.map((item, i) => (
            <div key={i} className={item.slot === 'weapon' ? 'weapon' : 'armor'} data-testid={`equipped-${item.slot}`}>
              <span style={{ marginRight: 4 }}>{item.icon}</span>{item.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
