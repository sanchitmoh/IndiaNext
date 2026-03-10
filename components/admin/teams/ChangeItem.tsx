"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  submissionId: string;
  timestamp: Date | string;
  action: "CREATE" | "UPDATE" | "DELETE";
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: "LEADER" | "CO_LEADER" | "MEMBER";
  };
  ipAddress: string | null;
  userAgent: string | null;
}

interface ChangeItemProps {
  change: AuditLogEntry;
}

// ── Main Component ──────────────────────────────────────────

export function ChangeItem({ change }: ChangeItemProps) {
  const [showFullDiff, setShowFullDiff] = useState(false);

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "text-emerald-400";
      case "DELETE":
        return "text-red-400";
      case "UPDATE":
        return "text-amber-400";
      default:
        return "text-gray-400";
    }
  };

  const isLongText = (value: string | null) => {
    return value && value.length > 100;
  };

  const hasLongText = isLongText(change.oldValue) || isLongText(change.newValue);

  return (
    <li className={`text-xs font-mono ${getActionColor(change.action)} group`}>
      <div className="flex items-start gap-2 p-2 -mx-2 rounded hover:bg-white/[0.02] transition-colors duration-200">
        <div className="flex-1">
          <span className="text-gray-400">
            {formatFieldName(change.fieldName)}:
          </span>{" "}
          {change.action === "CREATE" && (
            <span>
              <span className="text-emerald-400">Added:</span>{" "}
              <span className="text-gray-300">
                {showFullDiff || !isLongText(change.newValue)
                  ? `"${change.newValue}"`
                  : `"${change.newValue?.substring(0, 100)}..."`}
              </span>
            </span>
          )}
          {change.action === "DELETE" && (
            <span>
              <span className="text-red-400">Removed:</span>{" "}
              <span className="text-gray-300">
                {showFullDiff || !isLongText(change.oldValue)
                  ? `"${change.oldValue}"`
                  : `"${change.oldValue?.substring(0, 100)}..."`}
              </span>
            </span>
          )}
          {change.action === "UPDATE" && (
            <span>
              <span className="text-gray-500">
                {showFullDiff || !isLongText(change.oldValue)
                  ? `"${change.oldValue}"`
                  : `"${change.oldValue?.substring(0, 50)}..."`}
              </span>
              <span className="text-gray-600"> → </span>
              <span className="text-gray-300">
                {showFullDiff || !isLongText(change.newValue)
                  ? `"${change.newValue}"`
                  : `"${change.newValue?.substring(0, 50)}..."`}
              </span>
            </span>
          )}
        </div>
        {hasLongText && (
          <button
            onClick={() => setShowFullDiff(!showFullDiff)}
            className="text-blue-400 hover:text-blue-300 underline whitespace-nowrap text-xs transition-colors duration-200 hover:scale-105 transform"
          >
            {showFullDiff ? "Hide Full Diff" : "View Full Diff"}
          </button>
        )}
      </div>
    </li>
  );
}

// ── Helper Functions ────────────────────────────────────────

function formatFieldName(fieldName: string): string {
  // Convert camelCase to Title Case
  // Add space before capital letters and before numbers
  const formatted = fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/(\d)/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Handle specific field names
  const fieldNameMap: Record<string, string> = {
    "Team Name": "Team Name",
    "Hear About": "How Did You Hear About Us",
    "Additional Notes": "Additional Notes",
    "Member 2 Email": "Member 2 Email",
    "Member 2 Name": "Member 2 Name",
    "Member 2 College": "Member 2 College",
    "Member 2 Degree": "Member 2 Degree",
    "Member 2 Gender": "Member 2 Gender",
    "Member 3 Email": "Member 3 Email",
    "Member 3 Name": "Member 3 Name",
    "Member 3 College": "Member 3 College",
    "Member 3 Degree": "Member 3 Degree",
    "Member 3 Gender": "Member 3 Gender",
    "Member 4 Email": "Member 4 Email",
    "Member 4 Name": "Member 4 Name",
    "Member 4 College": "Member 4 College",
    "Member 4 Degree": "Member 4 Degree",
    "Member 4 Gender": "Member 4 Gender",
    "Idea Title": "Idea Title",
    "Problem Statement": "Problem Statement",
    "Proposed Solution": "Proposed Solution",
    "Target Users": "Target Users",
    "Expected Impact": "Expected Impact",
    "Tech Stack": "Tech Stack",
    "Doc Link": "Document Link",
    "Problem Desc": "Problem Description",
    "Github Link": "GitHub Link",
  };

  return fieldNameMap[formatted] || formatted;
}
