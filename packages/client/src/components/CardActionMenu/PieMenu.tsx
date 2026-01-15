import { useState, useCallback, useMemo } from "react";
import "./PieMenu.css";

export interface PieMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  color?: string; // CSS color for the wedge
  disabled?: boolean; // If true, wedge is shown but not clickable
}

export interface PieMenuProps {
  items: PieMenuItem[];
  onSelect: (id: string) => void;
  onCancel: () => void;
  centerContent?: React.ReactNode;
  /** Size of the menu in pixels (diameter) */
  size?: number;
  /** Inner radius as percentage of outer (0-1), creates donut shape */
  innerRadius?: number;
}

/**
 * Apex Legends-style pie/wheel menu with wedge segments.
 * Items are arranged in a circle around the center.
 */
export function PieMenu({
  items,
  onSelect,
  onCancel,
  centerContent,
  size = 300,
  innerRadius = 0.35,
}: PieMenuProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const outerRadius = size / 2;
  const inner = outerRadius * innerRadius;

  // Calculate wedge paths
  const wedges = useMemo(() => {
    const count = items.length;
    if (count === 0) return [];

    const anglePerItem = (2 * Math.PI) / count;
    // Start from top (-90 degrees) and go clockwise
    const startOffset = -Math.PI / 2 - anglePerItem / 2;

    return items.map((item, index) => {
      const startAngle = startOffset + index * anglePerItem;
      const endAngle = startAngle + anglePerItem;

      // Calculate arc path
      const path = describeArc(outerRadius, outerRadius, inner, outerRadius - 2, startAngle, endAngle);

      // Calculate label position (middle of wedge, between inner and outer)
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = (inner + outerRadius) / 2;
      const labelX = outerRadius + Math.cos(midAngle) * labelRadius;
      const labelY = outerRadius + Math.sin(midAngle) * labelRadius;

      return {
        ...item,
        path,
        labelX,
        labelY,
        midAngle,
      };
    });
  }, [items, outerRadius, inner]);

  const handleWedgeClick = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]);

  const handleCenterClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div className="pie-menu" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="pie-menu__svg"
      >
        {/* Wedges */}
        {wedges.map((wedge, index) => {
          const isDisabled = wedge.disabled;
          const isHovered = hoveredIndex === index && !isDisabled;
          return (
            <g key={wedge.id} className="pie-menu__wedge-group">
              <path
                d={wedge.path}
                className={`pie-menu__wedge ${isHovered ? "pie-menu__wedge--hovered" : ""} ${isDisabled ? "pie-menu__wedge--disabled" : ""}`}
                style={{
                  "--wedge-color": wedge.color || "rgba(60, 60, 70, 0.95)",
                } as React.CSSProperties}
                onMouseEnter={() => !isDisabled && setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => !isDisabled && handleWedgeClick(wedge.id)}
              />
            </g>
          );
        })}

        {/* Center circle (cancel zone) */}
        <circle
          cx={outerRadius}
          cy={outerRadius}
          r={inner - 4}
          className="pie-menu__center"
          onClick={handleCenterClick}
        />

        {/* Labels (rendered on top of wedges) */}
        {wedges.map((wedge, index) => {
          const isDisabled = wedge.disabled;
          const isHovered = hoveredIndex === index && !isDisabled;
          return (
            <g
              key={`label-${wedge.id}`}
              className={`pie-menu__label-group ${isHovered ? "pie-menu__label-group--hovered" : ""} ${isDisabled ? "pie-menu__label-group--disabled" : ""}`}
              style={{ pointerEvents: "none" }}
            >
              {wedge.icon && (
              <text
                x={wedge.labelX}
                y={wedge.labelY - 8}
                className="pie-menu__icon"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {wedge.icon}
              </text>
            )}
            <text
              x={wedge.labelX}
              y={wedge.labelY + (wedge.icon ? 8 : 0)}
              className="pie-menu__label"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {wedge.label}
            </text>
            {wedge.sublabel && (
              <text
                x={wedge.labelX}
                y={wedge.labelY + (wedge.icon ? 22 : 14)}
                className="pie-menu__sublabel"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {wedge.sublabel}
              </text>
            )}
            </g>
          );
        })}
      </svg>

      {/* Center content (rendered in HTML for flexibility) */}
      {centerContent && (
        <div className="pie-menu__center-content">
          {centerContent}
        </div>
      )}
    </div>
  );
}

/**
 * Creates an SVG arc path for a wedge/donut segment
 */
function describeArc(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
    "Z"
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}
