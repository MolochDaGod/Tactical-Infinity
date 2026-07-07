/**
 * CinzelOverlay
 *
 * Mountable HUD container vendored from attached_assets/UIlayer_*.html.
 * Renders the footer triptych: chat | hotbar | status (portrait+bars+buttons).
 *
 * Drop into any scene:
 *
 *     <CinzelOverlay />
 *
 * Override any field via the `state` prop. Anything you omit is filled
 * from the active captain (when one is set on `captainManager`) or from
 * a sane placeholder so the HUD never renders empty.
 */

import { useState, useMemo } from 'react';
import { CinzelHotbar }  from './CinzelHotbar';
import { CinzelHUDStats } from './CinzelHUDStats';
import { CinzelButtons, type CinzelPanel } from './CinzelButtons';
import { CinzelChat }    from './CinzelChat';
import { usePlayerHudState, type PlayerHudOverrides } from './usePlayerHudState';
import type { PlayerHudState } from './types';
import './cinzel.css';

interface Props {
  /** Optional override that wins over the live captain-derived defaults. */
  state?: PlayerHudOverrides;
  /** Called when a panel button (I/C/S) is toggled — for hosts that want to
   *  drive their own panel rendering. If omitted, the overlay only tracks
   *  internal active state for visual feedback. */
  onPanelToggle?: (panel: CinzelPanel | null) => void;
  /** Hide the chat strip (e.g. battle scenes). */
  hideChat?: boolean;
  /** Hide the centre hotbar. Use when the host scene already owns a bespoke
   *  bottom hotbar (e.g. sailing's port/starboard cannon HUD) and you only
   *  want the captain identity / status panel from Cinzel. When BOTH chat
   *  and hotbar are hidden the overlay automatically switches to its
   *  compact top-right corner layout. */
  hideHotbar?: boolean;
}

export function CinzelOverlay({ state, onPanelToggle, hideChat, hideHotbar }: Props) {
  const live: PlayerHudState = usePlayerHudState(state);
  const [active, setActive]  = useState<CinzelPanel | null>(null);

  const handleToggle = useMemo(() => (id: CinzelPanel) => {
    setActive(prev => {
      const next = prev === id ? null : id;
      onPanelToggle?.(next);
      return next;
    });
  }, [onPanelToggle]);

  // Compact mode: with no chat and no hotbar, the bottom-stretched layout
  // wastes the screen and risks colliding with whatever else lives at the
  // bottom. Pop into the top-right corner card instead.
  const isCompact = hideChat && hideHotbar;
  const rootClass = isCompact ? 'cinzel-hud cinzel-hud--compact' : 'cinzel-hud';

  return (
    <div className={rootClass} data-testid="cinzel-overlay">
      {!hideChat && <CinzelChat messages={live.chat} />}
      {!hideHotbar && <CinzelHotbar slots={live.hotbar} />}
      <div
        className="ui-element status-section"
        data-testid="cinzel-status-section"
      >
        <CinzelButtons active={active} onToggle={handleToggle} />
        <CinzelHUDStats state={live} onPortraitClick={() => handleToggle('character')} />
      </div>
    </div>
  );
}

export default CinzelOverlay;
