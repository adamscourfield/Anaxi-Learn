'use client';

import React, { useMemo, useState } from 'react';

interface Props {
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  emptyPrompt: string;
  helperText?: string;
}

interface DragState {
  choice: string;
  source: 'available' | 'selected';
  fromIndex: number;
}

function splitOrder(value: string): string[] {
  return value
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function serializeOrder(values: string[]): string {
  return values.join(' | ');
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return 0;
  if (index > length) return length;
  return index;
}

export function OrderedMagnetInput({ choices, value, onChange, emptyPrompt, helperText }: Props) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const orderedChoices = useMemo(() => splitOrder(value), [value]);
  const availableChoices = useMemo(
    () => choices.filter((choice) => !orderedChoices.includes(choice)),
    [choices, orderedChoices]
  );

  function updateOrderedChoices(next: string[]) {
    onChange(serializeOrder(next));
  }

  function addChoice(choice: string, atIndex = orderedChoices.length) {
    if (orderedChoices.includes(choice)) return;
    const next = [...orderedChoices];
    next.splice(clampIndex(atIndex, next.length), 0, choice);
    updateOrderedChoices(next);
  }

  function removeChoice(choice: string) {
    updateOrderedChoices(orderedChoices.filter((entry) => entry !== choice));
  }

  function moveChoice(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= orderedChoices.length) return;
    const next = [...orderedChoices];
    const [choice] = next.splice(fromIndex, 1);
    const insertIndex = clampIndex(toIndex, next.length);
    next.splice(insertIndex, 0, choice);
    updateOrderedChoices(next);
  }

  function handleDragStart(choice: string, source: 'available' | 'selected', fromIndex: number) {
    setDragState({ choice, source, fromIndex });
  }

  function handleDropToTray(insertIndex: number) {
    if (!dragState) return;
    if (dragState.source === 'available') {
      addChoice(dragState.choice, insertIndex);
    } else {
      const adjustedIndex = dragState.fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
      moveChoice(dragState.fromIndex, adjustedIndex);
    }
    setDragState(null);
    setDropIndex(null);
  }

  function handleDropToBank() {
    if (!dragState || dragState.source !== 'selected') return;
    removeChoice(dragState.choice);
    setDragState(null);
    setDropIndex(null);
  }

  function DropZone({ index }: { index: number }) {
    const active = dropIndex === index;
    return (
      <div
        aria-hidden="true"
        onDragOver={(event) => {
          event.preventDefault();
          setDropIndex(index);
        }}
        onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
        onDrop={(event) => {
          event.preventDefault();
          handleDropToTray(index);
        }}
        className={`h-3 rounded-full transition-colors ${active ? 'bg-blue-300' : 'bg-transparent'}`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-blue-900">Arrange the fridge magnets into the correct order</p>
          {orderedChoices.length > 0 && (
            <button
              type="button"
              onClick={() => updateOrderedChoices([])}
              className="text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
            >
              Clear order
            </button>
          )}
        </div>
        {helperText && <p className="mt-1 text-xs text-blue-700">{helperText}</p>}
        <div className="mt-4 rounded-2xl border border-dashed border-blue-300 bg-white p-4">
          {orderedChoices.length === 0 ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDropIndex(0);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDropToTray(0);
              }}
              className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 text-center text-sm text-blue-700"
            >
              {emptyPrompt}
            </div>
          ) : (
            <div className="space-y-2">
              <DropZone index={0} />
              {orderedChoices.map((choice, index) => (
                <div key={`${choice}-${index}`} className="space-y-2">
                  <div
                    draggable
                    onDragStart={() => handleDragStart(choice, 'selected', index)}
                    onDragEnd={() => {
                      setDragState(null);
                      setDropIndex(null);
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-blue-300 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{choice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChoice(choice)}
                      className="rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                  <DropZone index={index + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDropIndex(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          handleDropToBank();
        }}
        className="rounded-2xl border border-gray-200 bg-white p-4"
      >
        <p className="text-sm font-semibold text-gray-900">Available magnets</p>
        <p className="mt-1 text-xs text-gray-500">Drag a magnet up into the answer tray or tap to add it.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {availableChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              draggable
              onClick={() => addChoice(choice)}
              onDragStart={() => handleDragStart(choice, 'available', -1)}
              onDragEnd={() => {
                setDragState(null);
                setDropIndex(null);
              }}
              className="rounded-xl border border-gray-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {choice}
            </button>
          ))}
          {availableChoices.length === 0 && (
            <p className="text-sm text-gray-500">All magnets are in the answer tray. Drag one back here to remove it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
