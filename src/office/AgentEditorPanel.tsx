import { useEffect, useMemo, useState } from "react";
import type { Agent } from "@/types/state";
import { loadAgentOrientation, type AgentOrientationInfo } from "@/lib/officeLayoutApi";
import {
  CHARACTER_SHEET_OPTIONS,
  getCharacterOptionsByGender,
  type CharacterGender,
} from "./characterAssets";
import type { EditableAgentDetails, WorkstationOrigin } from "./useOfficeEditorState";
import { useDraggablePanel } from "./useDraggablePanel";

interface AgentEditorPanelProps {
  scope: string;
  agent: Agent;
  details: EditableAgentDetails;
  workstationOrigin?: WorkstationOrigin;
  usedSheetIndices: number[];
  isSaving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSaveDraft: (draft: {
    gender: CharacterGender;
    sheetIndex: number;
    origin: WorkstationOrigin;
  }) => void;
  onRemove?: () => void;
}

export function AgentEditorPanel({
  scope,
  agent,
  details,
  workstationOrigin,
  usedSheetIndices,
  isSaving = false,
  saveError = null,
  onClose,
  onSaveDraft,
  onRemove,
}: AgentEditorPanelProps) {
  const [draftGender, setDraftGender] = useState<CharacterGender>(details.gender);
  const [draftSheetIndex, setDraftSheetIndex] = useState(details.sheetIndex);
  const [draftOrigin, setDraftOrigin] = useState<WorkstationOrigin>({
    originX: workstationOrigin?.originX ?? 0,
    originY: workstationOrigin?.originY ?? 0,
  });
  const [showOrientation, setShowOrientation] = useState(false);
  const [orientationInfo, setOrientationInfo] = useState<AgentOrientationInfo | null>(null);
  const [orientationError, setOrientationError] = useState<string | null>(null);
  const [orientationLoading, setOrientationLoading] = useState(false);

  useEffect(() => {
    setDraftGender(details.gender);
    setDraftSheetIndex(details.sheetIndex);
    setDraftOrigin({
      originX: workstationOrigin?.originX ?? 0,
      originY: workstationOrigin?.originY ?? 0,
    });
    setShowOrientation(false);
    setOrientationInfo(null);
    setOrientationError(null);
    setOrientationLoading(false);
  }, [
    details.gender,
    details.id,
    details.sheetIndex,
    workstationOrigin?.originX,
    workstationOrigin?.originY,
  ]);

  const avatarOptions = useMemo(
    () => getCharacterOptionsByGender(draftGender),
    [draftGender]
  );
  const { panelRef, positionStyle, dragHandleProps } = useDraggablePanel({
    defaultTop: 20,
    defaultRight: 20,
  });
  const reserved = useMemo(() => new Set(usedSheetIndices), [usedSheetIndices]);
  const selectedOption = CHARACTER_SHEET_OPTIONS[draftSheetIndex];
  const hasDraftChanges =
    draftGender !== details.gender ||
    draftSheetIndex !== details.sheetIndex ||
    draftOrigin.originX !== (workstationOrigin?.originX ?? 0) ||
    draftOrigin.originY !== (workstationOrigin?.originY ?? 0);

  const onGenderChange = (gender: CharacterGender) => {
    const fallback =
      getCharacterOptionsByGender(gender).find((option) => !reserved.has(option.index)) ??
      getCharacterOptionsByGender(gender)[0] ??
      CHARACTER_SHEET_OPTIONS[0];

    setDraftGender(gender);
    setDraftSheetIndex(
      CHARACTER_SHEET_OPTIONS[draftSheetIndex]?.gender === gender &&
        !reserved.has(draftSheetIndex)
        ? draftSheetIndex
        : fallback.index
    );
  };

  const toggleOrientation = async () => {
    if (showOrientation) {
      setShowOrientation(false);
      return;
    }

    setShowOrientation(true);
    if (orientationInfo || orientationLoading) return;

    setOrientationLoading(true);
    setOrientationError(null);

    try {
      setOrientationInfo(await loadAgentOrientation(scope, agent.id));
    } catch {
      setOrientationError("Nao foi possivel carregar a orientacao tecnica deste agente.");
    } finally {
      setOrientationLoading(false);
    }
  };

  return (
    <div ref={panelRef} style={{ ...panelStyle, ...positionStyle }}>
      <div
        style={{ ...headerStyle, ...dragHandleProps.style }}
        onPointerDown={dragHandleProps.onPointerDown}
      >
        <div>
          <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 1 }}>EDITOR</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{details.name}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          style={ghostButtonStyle}
        >
          Fechar
        </button>
      </div>

      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span>Genero</span>
          <select
            value={draftGender}
            onChange={(event) => onGenderChange(event.target.value as CharacterGender)}
            style={inputStyle}
          >
            <option value="Homem">Homem</option>
            <option value="Mulher">Mulher</option>
          </select>
        </label>

        <div style={{ ...fieldStyle, justifyContent: "flex-end" }}>
          <span>Avatar selecionado</span>
          <div style={selectedAvatarCardStyle}>
            {selectedOption && <AvatarSpritePreview path={selectedOption.path} selected />}
            <div style={{ fontSize: 12, color: "#dce7ff" }}>{selectedOption?.label ?? "avatar"}</div>
          </div>
        </div>

        <label style={fieldStyle}>
          <span>Mesa X</span>
          <input
            type="number"
            value={Math.round(draftOrigin.originX)}
            onChange={(event) =>
              setDraftOrigin({
                originX: Number(event.target.value),
                originY: draftOrigin.originY,
              })
            }
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span>Mesa Y</span>
          <input
            type="number"
            value={Math.round(draftOrigin.originY)}
            onChange={(event) =>
              setDraftOrigin({
                originX: draftOrigin.originX,
                originY: Number(event.target.value),
              })
            }
            style={inputStyle}
          />
        </label>
      </div>

      <div style={avatarSectionStyle}>
        <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 0.8 }}>ESCOLHER AVATAR</div>
        <div style={avatarGridStyle}>
          {avatarOptions.map((option) => {
            const disabled = reserved.has(option.index) && option.index !== draftSheetIndex;
            const selected = option.index === draftSheetIndex;

            return (
              <button
                key={option.index}
                type="button"
                disabled={disabled}
                onClick={() => setDraftSheetIndex(option.index)}
                style={{
                  ...avatarButtonStyle,
                  ...(selected ? selectedAvatarButtonStyle : null),
                  ...(disabled ? disabledAvatarButtonStyle : null),
                }}
              >
                <AvatarSpritePreview path={option.path} selected={selected} />
                <div style={{ fontSize: 11, lineHeight: 1.2 }}>{option.label}</div>
                <div style={{ fontSize: 10, color: disabled ? "#ffabab" : "#90a6cb" }}>
                  {disabled ? "Em uso" : selected ? "Selecionado" : "Livre"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showOrientation && (
        <div style={orientationPanelStyle}>
          <div style={orientationHeaderStyle}>
            <div style={{ fontWeight: 700 }}>Ficha</div>
            {orientationInfo?.filePath && (
              <div style={orientationPathStyle}>{orientationInfo.filePath}</div>
            )}
          </div>
          <div style={orientationContentStyle}>
            {orientationLoading
              ? "Carregando orientacao tecnica..."
              : orientationError
                ? orientationError
                : orientationInfo?.content ?? "Sem orientacao tecnica para este agente."}
          </div>
        </div>
      )}

      {saveError && <div style={saveInfoStyle}>{saveError}</div>}

      <div style={footerActionsStyle}>
        <button type="button" onClick={() => void toggleOrientation()} style={ghostButtonStyle}>
          Ficha
        </button>
        <button
          type="button"
          onClick={() =>
            onSaveDraft({
              gender: draftGender,
              sheetIndex: draftSheetIndex,
              origin: draftOrigin,
            })
          }
          style={{
            ...primaryButtonStyle,
            ...(isSaving ? savingButtonStyle : null),
          }}
          disabled={isSaving || !hasDraftChanges}
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} style={dangerButtonStyle}>
            Remover avatar
          </button>
        )}
      </div>
    </div>
  );
}

function AvatarSpritePreview({ path, selected = false }: { path: string; selected?: boolean }) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: selected ? "rgba(39, 67, 120, 0.85)" : "rgba(24, 31, 48, 0.9)",
        border: `1px solid ${selected ? "rgba(95, 163, 255, 0.7)" : "rgba(120, 146, 190, 0.3)"}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          margin: "4px auto",
          backgroundImage: `url("${path}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "144px 192px",
          backgroundPosition: "-48px 0px",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  width: 560,
  maxWidth: "calc(100% - 40px)",
  padding: 18,
  borderRadius: 16,
  background: "rgba(14, 18, 28, 0.96)",
  border: "1px solid rgba(91, 125, 186, 0.45)",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  color: "#eef4ff",
  zIndex: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
};

const selectedAvatarCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 52,
  borderRadius: 12,
  padding: "8px 10px",
  background: "rgba(24, 31, 48, 0.85)",
  border: "1px solid rgba(120, 146, 190, 0.35)",
};

const avatarSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255, 255, 255, 0.03)",
};

const avatarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
  gap: 10,
};

const avatarButtonStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(120, 146, 190, 0.25)",
  background: "rgba(18, 24, 38, 0.95)",
  padding: "10px 8px",
  color: "#eef4ff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  minHeight: 122,
};

const selectedAvatarButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(95, 163, 255, 0.8)",
  background: "rgba(24, 38, 65, 0.95)",
  boxShadow: "0 0 0 1px rgba(95, 163, 255, 0.25) inset",
};

const disabledAvatarButtonStyle: React.CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(120, 146, 190, 0.35)",
  background: "rgba(24, 31, 48, 0.85)",
  color: "#eef4ff",
  padding: "10px 12px",
  outline: "none",
};

const orientationPanelStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: "calc(100% + 18px)",
  width: 420,
  maxWidth: "min(420px, calc(100vw - 40px))",
  height: "100%",
  display: "grid",
  gap: 8,
  padding: 12,
  borderRadius: 12,
  background: "rgba(14, 18, 28, 0.98)",
  border: "1px solid rgba(91, 125, 186, 0.35)",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.28)",
  fontSize: 12,
  color: "#cdd7ea",
  overflow: "hidden",
};

const orientationHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const orientationPathStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#8ea4c9",
  wordBreak: "break-all",
};

const orientationContentStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  height: "100%",
  overflowY: "auto",
  lineHeight: 1.5,
};

const ghostButtonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(120, 146, 190, 0.35)",
  background: "transparent",
  color: "#dce7ff",
  padding: "8px 12px",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(110, 165, 255, 0.45)",
  background: "rgba(20, 56, 112, 0.95)",
  color: "#eef4ff",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const savingButtonStyle: React.CSSProperties = {
  opacity: 0.75,
  cursor: "wait",
};

const saveInfoStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(98, 28, 28, 0.26)",
  border: "1px solid rgba(224, 95, 95, 0.28)",
  color: "#ffd1d1",
  fontSize: 12,
};

const footerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const dangerButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255, 113, 113, 0.45)",
  background: "rgba(120, 22, 22, 0.4)",
  color: "#ffd9d9",
  padding: "10px 12px",
  cursor: "pointer",
};
