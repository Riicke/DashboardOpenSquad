import { useMemo, useState } from "react";
import { OFFICE_OBJECT_LIBRARY, type OfficeAssetKey } from "./officeAssets";
import type { OfficeObjectOverride } from "./useOfficeEditorState";
import { useDraggablePanel } from "./useDraggablePanel";

export interface EditableOfficeObject {
  id: string;
  label: string;
  assetKey: OfficeAssetKey;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
  layer: number;
  isCustom: boolean;
}

interface OfficeObjectsEditorPanelProps {
  objects: EditableOfficeObject[];
  selectedObjectId: string | null;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSave: () => void;
  onUpdate: (objectId: string, patch: OfficeObjectOverride) => void;
  onReset: (objectId: string) => void;
  onAddObject: (assetKey: OfficeAssetKey) => void;
  onRemoveObject: (objectId: string) => void;
}

export function OfficeObjectsEditorPanel({
  objects,
  selectedObjectId,
  isSaving = false,
  hasUnsavedChanges = false,
  saveError = null,
  onClose,
  onSave,
  onUpdate,
  onReset,
  onAddObject,
  onRemoveObject,
}: OfficeObjectsEditorPanelProps) {
  const { panelRef, positionStyle, dragHandleProps } = useDraggablePanel({
    defaultTop: 20,
    defaultRight: 20,
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const selectedObject = objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedObjectHidden = selectedObject ? isObjectHidden(selectedObject) : false;
  const assetUsageCount = useMemo(
    () =>
      objects.reduce<Record<string, number>>((acc, object) => {
        acc[object.assetKey] = (acc[object.assetKey] ?? 0) + 1;
        return acc;
      }, {}),
    [objects]
  );
  const assetLabel = useMemo(
    () => OFFICE_OBJECT_LIBRARY.find((asset) => asset.key === selectedObject?.assetKey)?.label ?? selectedObject?.assetKey,
    [selectedObject?.assetKey]
  );

  return (
    <div ref={panelRef} style={{ ...panelStyle, ...positionStyle }}>
      <div
        style={{ ...headerStyle, ...dragHandleProps.style }}
        onPointerDown={dragHandleProps.onPointerDown}
      >
        <div>
          <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 1 }}>OFFICE</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Editar objetos</div>
        </div>
        <div style={headerActionsStyle}>
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            onPointerDown={(event) => event.stopPropagation()}
            style={primaryButtonStyle}
          >
            Add +
          </button>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            style={ghostButtonStyle}
          >
            Fechar
          </button>
        </div>
      </div>

      {!selectedObject ? (
        <>
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Nenhum objeto selecionado</div>
            <div>Clique em um objeto da cena para editar.</div>
            <div>O nome do objeto so aparece quando ele estiver selecionado.</div>
          </div>
          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={onSave}
              style={{
                ...primaryButtonStyle,
                ...(isSaving ? savingButtonStyle : null),
              }}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={selectedObjectTitleStyle}>
            {selectedObject.label}
            {selectedObjectHidden ? " (oculto)" : ""}
          </div>

          <div style={gridStyle}>
            <NumericField
              label="X"
              value={selectedObject.x}
              onChange={(value) => onUpdate(selectedObject.id, { x: value })}
            />
            <NumericField
              label="Y"
              value={selectedObject.y}
              onChange={(value) => onUpdate(selectedObject.id, { y: value })}
            />
            <NumericField
              label="Largura"
              value={selectedObject.width}
              onChange={(value) => onUpdate(selectedObject.id, { width: Math.max(12, value) })}
            />
            <NumericField
              label="Altura"
              value={selectedObject.height}
              onChange={(value) => onUpdate(selectedObject.id, { height: Math.max(12, value) })}
            />
            <NumericField
              label="Rotacao"
              value={selectedObject.rotation}
              onChange={(value) => onUpdate(selectedObject.id, { rotation: value })}
            />
            <NumericField
              label="Camada"
              value={selectedObject.layer}
              onChange={(value) => onUpdate(selectedObject.id, { layer: value })}
            />
            <NumericField
              label="Alpha"
              value={selectedObject.alpha}
              step={0.05}
              min={0}
              max={1}
              onChange={(value) =>
                onUpdate(selectedObject.id, { alpha: Math.max(0, Math.min(1, value)) })
              }
            />
          </div>

          <div style={infoPanelStyle}>
            <div>
              <strong>Asset:</strong> {assetLabel}
            </div>
            <div>
              <strong>Tipo:</strong> {selectedObject.isCustom ? "adicionado no editor" : "objeto base"}
            </div>
            <div>
              <strong>Visibilidade:</strong> {selectedObjectHidden ? "oculto" : "visivel"}
            </div>
            <div>
              <strong>Estacao operacional:</strong> mesa viva continua no editor do avatar (`Mesa X/Y`)
            </div>
          </div>

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={onSave}
              style={{
                ...primaryButtonStyle,
                ...(isSaving ? savingButtonStyle : null),
              }}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => onReset(selectedObject.id)} style={resetButtonStyle}>
              Resetar objeto
            </button>
            <button
              type="button"
              onClick={() => onRemoveObject(selectedObject.id)}
              style={dangerButtonStyle}
            >
              Deletar objeto
            </button>
          </div>
        </>
      )}

      {saveError && <div style={saveInfoStyle}>{saveError}</div>}

      {isLibraryOpen && (
        <div style={libraryOverlayStyle} onPointerDown={(event) => event.stopPropagation()}>
          <div style={libraryPanelStyle}>
            <div style={libraryHeaderStyle}>
              <div>
                <div style={{ fontSize: 12, color: "#8db4ff", letterSpacing: 1 }}>BIBLIOTECA</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Escolher objeto</div>
              </div>
              <button type="button" onClick={() => setIsLibraryOpen(false)} style={ghostButtonStyle}>
                Fechar
              </button>
            </div>

            <div style={libraryGridStyle}>
              {OFFICE_OBJECT_LIBRARY.map((asset) => (
                (() => {
                  const usageCount = assetUsageCount[asset.key] ?? 0;
                  const singletonLocked =
                    typeof asset.maxInstances === "number" && usageCount >= asset.maxInstances;

                  return (
                    <button
                      key={asset.key}
                      type="button"
                      disabled={singletonLocked}
                      onClick={() => {
                        if (singletonLocked) return;
                        onAddObject(asset.key);
                        setIsLibraryOpen(false);
                      }}
                      style={{
                        ...libraryCardStyle,
                        ...(singletonLocked ? lockedLibraryCardStyle : null),
                      }}
                    >
                      <div style={libraryPreviewFrameStyle}>
                        <img src={asset.path} alt={asset.label} style={libraryPreviewImageStyle} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{asset.label}</div>
                      <div style={{ fontSize: 11, color: "#90a6cb" }}>
                        {asset.width}x{asset.height}
                      </div>
                      {singletonLocked && (
                        <div style={{ fontSize: 10, color: "#ffb4b4" }}>Ja existe no office</div>
                      )}
                    </button>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

function isObjectHidden(object: EditableOfficeObject) {
  return object.alpha <= 0.01 || object.width <= 0 || object.height <= 0;
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  width: 480,
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

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
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
  whiteSpace: "nowrap",
};

const resetButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(234, 196, 102, 0.45)",
  background: "rgba(100, 76, 18, 0.38)",
  color: "#ffe9b5",
  padding: "10px 12px",
  cursor: "pointer",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const infoPanelStyle: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(24, 31, 48, 0.65)",
  border: "1px solid rgba(120, 146, 190, 0.15)",
  padding: "12px 14px",
  fontSize: 12,
  lineHeight: 1.55,
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(24, 31, 48, 0.45)",
  border: "1px dashed rgba(120, 146, 190, 0.28)",
  padding: "16px 14px",
  fontSize: 12,
  lineHeight: 1.55,
  color: "#cdd7ea",
  display: "grid",
  gap: 4,
};

const selectedObjectTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#eef4ff",
};

const dangerButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(224, 95, 95, 0.45)",
  background: "rgba(98, 28, 28, 0.42)",
  color: "#ffd1d1",
  padding: "10px 12px",
  cursor: "pointer",
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

const libraryOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6, 10, 18, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 40,
};

const libraryPanelStyle: React.CSSProperties = {
  width: 760,
  maxWidth: "min(92vw, 760px)",
  maxHeight: "min(76vh, 720px)",
  overflow: "hidden",
  borderRadius: 18,
  background: "rgba(14, 18, 28, 0.98)",
  border: "1px solid rgba(91, 125, 186, 0.45)",
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.42)",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
};

const libraryHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const libraryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 14,
  overflowY: "auto",
  paddingRight: 6,
};

const libraryCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(120, 146, 190, 0.25)",
  background: "rgba(24, 31, 48, 0.86)",
  color: "#eef4ff",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "center",
};

const lockedLibraryCardStyle: React.CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const libraryPreviewFrameStyle: React.CSSProperties = {
  width: "100%",
  height: 120,
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(42, 55, 84, 0.85), rgba(20, 27, 40, 0.95))",
  border: "1px solid rgba(120, 146, 190, 0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const libraryPreviewImageStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  imageRendering: "pixelated",
};
