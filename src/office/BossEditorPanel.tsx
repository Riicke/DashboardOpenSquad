import { useEffect, useMemo, useState } from "react";
import {
  CHARACTER_SHEET_OPTIONS,
  getCharacterOptionsByGender,
  type CharacterGender,
} from "./characterAssets";
import type { PlayerAppearance } from "./useOfficeEditorState";
import { useDraggablePanel } from "./useDraggablePanel";

interface BossEditorPanelProps {
  appearance: PlayerAppearance;
  isSaving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSaveDraft: (patch: Partial<PlayerAppearance>) => void;
}

export function BossEditorPanel({
  appearance,
  isSaving = false,
  saveError = null,
  onClose,
  onSaveDraft,
}: BossEditorPanelProps) {
  const [draftAppearance, setDraftAppearance] = useState<PlayerAppearance>(appearance);

  useEffect(() => {
    setDraftAppearance(appearance);
  }, [appearance.gender, appearance.sheetIndex]);

  const { panelRef, positionStyle, dragHandleProps } = useDraggablePanel({
    defaultTop: 20,
    defaultRight: 20,
  });
  const avatarOptions = useMemo(
    () => getCharacterOptionsByGender(draftAppearance.gender),
    [draftAppearance.gender]
  );
  const selectedOption = CHARACTER_SHEET_OPTIONS[draftAppearance.sheetIndex];
  const hasDraftChanges =
    draftAppearance.gender !== appearance.gender ||
    draftAppearance.sheetIndex !== appearance.sheetIndex;

  const onGenderChange = (gender: CharacterGender) => {
    const fallback =
      getCharacterOptionsByGender(gender)[0] ??
      CHARACTER_SHEET_OPTIONS[0];

    setDraftAppearance((current) => ({
      ...current,
      gender,
      sheetIndex:
        CHARACTER_SHEET_OPTIONS[current.sheetIndex]?.gender === gender
          ? current.sheetIndex
          : fallback.index,
    }));
  };

  return (
    <div ref={panelRef} style={{ ...panelStyle, ...positionStyle }}>
      <div
        style={{ ...headerStyle, ...dragHandleProps.style }}
        onPointerDown={dragHandleProps.onPointerDown}
      >
        <div>
          <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 1 }}>BOSS</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Aparencia principal</div>
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
            value={draftAppearance.gender}
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
      </div>

      <div style={avatarSectionStyle}>
        <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 0.8 }}>ESCOLHER AVATAR</div>
        <div style={avatarGridStyle}>
          {avatarOptions.map((option) => {
            const selected = option.index === draftAppearance.sheetIndex;

            return (
              <button
                key={option.index}
                type="button"
                onClick={() =>
                  setDraftAppearance((current) => ({
                    ...current,
                    sheetIndex: option.index,
                  }))
                }
                style={{
                  ...avatarButtonStyle,
                  ...(selected ? selectedAvatarButtonStyle : null),
                }}
              >
                <AvatarSpritePreview path={option.path} selected={selected} />
                <div style={{ fontSize: 11, lineHeight: 1.2 }}>{option.label}</div>
                <div style={{ fontSize: 10, color: selected ? "#dce7ff" : "#90a6cb" }}>
                  {selected ? "Selecionado" : "Escolher"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {saveError && <div style={saveInfoStyle}>{saveError}</div>}

      <div style={footerActionsStyle}>
        <button
          type="button"
          onClick={() => onSaveDraft(draftAppearance)}
          style={{
            ...primaryButtonStyle,
            ...(isSaving ? savingButtonStyle : null),
          }}
          disabled={isSaving || !hasDraftChanges}
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
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

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(120, 146, 190, 0.35)",
  background: "rgba(24, 31, 48, 0.85)",
  color: "#eef4ff",
  padding: "10px 12px",
  outline: "none",
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
