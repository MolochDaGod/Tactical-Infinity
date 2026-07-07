import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Crown, Shield, ChevronUp, ChevronDown, LogOut, Edit, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GuildData, GuildMember } from '../MainGamePanel';

interface GuildPanelProps {
  guildData?: GuildData;
  currentPlayerName?: string;
  onSetNotice?: (notice: string) => void;
  onPromote?: (memberName: string) => void;
  onDemote?: (memberName: string) => void;
  onKick?: (memberName: string) => void;
  onLeave?: () => void;
}

const RANK_LABELS: Record<number, string> = {
  0: 'Member',
  1: 'Officer',
  2: 'Vice Master',
  3: 'Guild Master',
};

const RANK_COLORS: Record<number, string> = {
  0: 'text-slate-300',
  1: 'text-blue-400',
  2: 'text-purple-400',
  3: 'text-amber-400',
};

function MemberRow({
  member,
  currentPlayerName,
  currentPlayerRank,
  onPromote,
  onDemote,
  onKick,
}: {
  member: GuildMember;
  currentPlayerName?: string;
  currentPlayerRank: number;
  onPromote?: () => void;
  onDemote?: () => void;
  onKick?: () => void;
}) {
  const isCurrentPlayer = member.name === currentPlayerName;
  const isMaster = member.rank === 3;
  const canPromote = currentPlayerRank >= 2 && member.rank < currentPlayerRank && member.rank < 2;
  const canDemote = currentPlayerRank >= 2 && member.rank < currentPlayerRank && member.rank > 0;
  const canKick = currentPlayerRank >= 1 && member.rank < currentPlayerRank && !isCurrentPlayer;

  return (
    <motion.div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        isCurrentPlayer
          ? 'bg-amber-900/20 border-amber-500/30'
          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
      )}
      data-testid={`guild-member-${member.name}`}
    >
      <div
        className={cn(
          'w-3 h-3 rounded-full',
          member.online ? 'bg-green-500' : 'bg-slate-600'
        )}
        title={member.online ? 'Online' : 'Offline'}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isMaster && <Crown className="w-4 h-4 text-amber-400" />}
          <span className={cn('font-medium truncate', isCurrentPlayer && 'text-amber-300')}>
            {member.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Lv. {member.level}</span>
          <span className={RANK_COLORS[member.rank]}>{RANK_LABELS[member.rank]}</span>
        </div>
      </div>

      {!isCurrentPlayer && (
        <div className="flex items-center gap-1">
          {canPromote && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPromote}
              className="w-7 h-7 text-green-400 hover:bg-green-900/30"
              title="Promote"
              data-testid={`promote-${member.name}`}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          )}
          {canDemote && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDemote}
              className="w-7 h-7 text-orange-400 hover:bg-orange-900/30"
              title="Demote"
              data-testid={`demote-${member.name}`}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          )}
          {canKick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onKick}
              className="w-7 h-7 text-red-400 hover:bg-red-900/30"
              title="Kick"
              data-testid={`kick-${member.name}`}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function GuildPanel({
  guildData,
  currentPlayerName,
  onSetNotice,
  onPromote,
  onDemote,
  onKick,
  onLeave,
}: GuildPanelProps) {
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState(guildData?.notice || '');

  const currentMember = guildData?.members?.find((m) => m.name === currentPlayerName);
  const currentRank = currentMember?.rank || 0;
  const canEditNotice = currentRank >= 2;
  const canLeave = currentRank < 3;

  const onlineCount = guildData?.members?.filter((m) => m.online).length || 0;

  const handleSaveNotice = () => {
    if (noticeText !== guildData?.notice) {
      onSetNotice?.(noticeText);
    }
    setIsEditingNotice(false);
  };

  if (!guildData || !guildData.name) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <Users className="w-16 h-16 opacity-30" />
        <p className="text-lg">You are not in a guild</p>
        <p className="text-sm text-slate-500">Join or create a guild to access this panel</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-400" />
          <div>
            <h3 className="text-lg font-cinzel font-bold text-amber-200">
              {guildData.name}
            </h3>
            <p className="text-xs text-slate-400">
              Master: <span className="text-amber-400">{guildData.master}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-green-400">{onlineCount}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{guildData.memberCount}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-500">{guildData.maxMembers}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-400">Guild Notice</h4>
          {canEditNotice && !isEditingNotice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNoticeText(guildData.notice || '');
                setIsEditingNotice(true);
              }}
              className="text-amber-400 hover:bg-amber-900/30"
              data-testid="button-edit-notice"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        {isEditingNotice ? (
          <div className="space-y-2">
            <Textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              maxLength={200}
              className="bg-slate-900 border-slate-600 text-slate-200 resize-none"
              rows={3}
              data-testid="input-notice"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{noticeText.length}/200</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotice(false)}
                  className="text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotice}
                  className="bg-amber-600 hover:bg-amber-500"
                  data-testid="button-save-notice"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {guildData.notice || 'No guild notice set.'}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <h4 className="text-sm font-bold text-slate-400 mb-2">
          Members ({guildData.memberCount})
        </h4>
        <ScrollArea className="h-[calc(100%-28px)] bg-slate-800/30 rounded-lg border border-slate-700 p-2">
          <div className="space-y-2">
            {guildData.members
              ?.slice()
              .sort((a, b) => {
                if (b.rank !== a.rank) return b.rank - a.rank;
                if (a.online !== b.online) return a.online ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((member) => (
                <MemberRow
                  key={member.name}
                  member={member}
                  currentPlayerName={currentPlayerName}
                  currentPlayerRank={currentRank}
                  onPromote={() => onPromote?.(member.name)}
                  onDemote={() => onDemote?.(member.name)}
                  onKick={() => onKick?.(member.name)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {canLeave && (
        <div className="flex justify-end pt-2 border-t border-slate-700">
          <Button
            variant="outline"
            size="sm"
            onClick={onLeave}
            className="text-red-400 border-red-500/30 hover:bg-red-900/30"
            data-testid="button-leave-guild"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Guild
          </Button>
        </div>
      )}
    </div>
  );
}
