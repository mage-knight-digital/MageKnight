import "./RadialMenu.css";

export interface RadialMenuItem {
  id: string;
  label: string;
  icon?: string;
  sublabel?: string;
}

interface RadialMenuProps {
  items: RadialMenuItem[];
  onSelect: (id: string) => void;
  onCancel: () => void;
  centerX?: number;
  centerY?: number;
}

export function RadialMenu({
  items,
  onSelect,
  onCancel,
  centerX,
  centerY,
}: RadialMenuProps) {
  const itemCount = items.length;
  const radius = 120; // Distance from center to items

  // Calculate position for each item around the circle
  // Start from top (-90deg) and go clockwise
  const getItemStyle = (index: number): React.CSSProperties => {
    const angleStep = 360 / itemCount;
    const angleDeg = -90 + index * angleStep; // Start from top
    const angleRad = (angleDeg * Math.PI) / 180;

    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;

    return {
      transform: `translate(${x}px, ${y}px)`,
    };
  };

  const overlayStyle: React.CSSProperties = centerX !== undefined && centerY !== undefined
    ? { "--center-x": `${centerX}px`, "--center-y": `${centerY}px` } as React.CSSProperties
    : {};

  return (
    <div className="radial-menu-overlay" onClick={onCancel} style={overlayStyle}>
      <div className="radial-menu" onClick={(e) => e.stopPropagation()}>
        {/* Center cancel button */}
        <button
          className="radial-menu__center"
          onClick={onCancel}
          type="button"
          aria-label="Cancel"
        >
          ✕
        </button>

        {/* Menu items arranged in circle */}
        {items.map((item, index) => (
          <button
            key={item.id}
            className="radial-menu__item"
            style={getItemStyle(index)}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {item.icon && <span className="radial-menu__icon">{item.icon}</span>}
            <span className="radial-menu__label">{item.label}</span>
            {item.sublabel && (
              <span className="radial-menu__sublabel">{item.sublabel}</span>
            )}
          </button>
        ))}

        {/* Connecting lines from center to items (visual only) */}
        <svg className="radial-menu__lines" viewBox="-150 -150 300 300">
          {items.map((_, index) => {
            const angleStep = 360 / itemCount;
            const angleDeg = -90 + index * angleStep;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.cos(angleRad) * (radius - 30);
            const y = Math.sin(angleRad) * (radius - 30);
            return (
              <line
                key={index}
                x1="0"
                y1="0"
                x2={x}
                y2={y}
                className="radial-menu__line"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
