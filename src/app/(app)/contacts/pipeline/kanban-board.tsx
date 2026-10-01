"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { updateContactStage } from "../actions";

export type KanbanCard = { id: string; name: string; stage: string; subtitle?: string | null };
export type KanbanColumn = { key: string; label: string };

/**
 * Tableau Kanban d'un pipeline.
 * - À la souris : cliquer-glisser une carte vers une autre colonne.
 * - Au doigt : appui long (¼ de seconde) sur une carte, puis glisser.
 * Le changement d'étape est enregistré immédiatement.
 */
export function KanbanBoard({
  pipeline,
  columns,
  initialCards,
}: {
  pipeline: "vendeur" | "acquereur";
  columns: KanbanColumn[];
  initialCards: KanbanCard[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Identifiant stable entre serveur et navigateur (évite un avertissement d'hydratation de dnd-kit).
  const dndId = useId();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const cardId = String(event.active.id);
    const target = event.over ? String(event.over.id) : null;
    const card = cards.find((c) => c.id === cardId);
    if (!card || !target || target === card.stage) return;

    const previous = card.stage;
    // Mise à jour immédiate à l'écran, annulée en cas d'erreur.
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, stage: target } : c)));
    startTransition(async () => {
      const result = await updateContactStage(cardId, pipeline, target);
      if ("error" in result) {
        setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, stage: previous } : c)));
        toast.error(result.error);
      }
    });
  }

  const activeCard = cards.find((c) => c.id === activeId);

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {columns.map((col) => (
          <Column key={col.key} column={col} cards={cards.filter((c) => c.stage === col.key)} activeId={activeId} />
        ))}
      </div>
      <DragOverlay>{activeCard ? <CardView card={activeCard} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ column, cards, activeId }: { column: KanbanColumn; cards: KanbanCard[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/60 p-2 md:w-64",
        isOver && "border-primary bg-accent",
      )}
    >
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold">
        {column.label}
        <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">{cards.length}</span>
      </h2>
      <div className="flex min-h-24 flex-col gap-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} hidden={card.id === activeId} />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({ card, hidden }: { card: KanbanCard; hidden: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", hidden && "opacity-30")}>
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, dragging = false }: { card: KanbanCard; dragging?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border bg-card p-3 shadow-xs select-none", dragging && "rotate-2 shadow-lg")}>
      <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <Link href={`/contacts/${card.id}`} className="block truncate text-sm font-medium hover:underline" draggable={false}>
          {card.name}
        </Link>
        {card.subtitle && <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>}
      </div>
    </div>
  );
}
