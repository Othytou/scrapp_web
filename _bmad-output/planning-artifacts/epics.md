---
stepsCompleted: ["lightweight-manual", "validated"]
inputDocuments: []
note: "Pas de PRD/Architecture formels pour ce projet perso — epics et stories rédigés directement à partir de la conversation avec l'utilisateur (2026-08-14)."
---

# scrapp_web - Epic Breakdown

## Overview

Pas de PRD formel pour ce projet personnel — ce document sert de mémoire/visu sur les épics et stories liés à l'évolution IA du pipeline CV, issus directement des échanges avec l'utilisateur plutôt que d'une extraction FR/NFR.

## Epic List

1. Claude et amélioration IA

## Epic 1: Claude et amélioration IA

Faire évoluer le pipeline de génération de CV pour s'appuyer sur l'abonnement Claude Pro (via un skill Claude Code) plutôt que sur l'API Anthropic facturée au token, et explorer comment déclencher cette génération automatiquement dès qu'une offre est capturée.

### Story 1.1: Mettre en place un cron

As a Chef,
I want déclencher automatiquement la génération du CV dès qu'une offre est capturée en base, via un job cron qui invoque `claude -p` en mode headless,
So that le pipeline tourne de façon autonome — sans dépendre d'une session Claude Code ouverte — tout en consommant l'abonnement Pro plutôt que l'API facturée.

**Statut : non démarré.** Alternative documentée à l'automatisation par `/loop` en session interactive (qui elle s'arrête dès que la session se ferme) — voir échange du 2026-08-14.

**Acceptance Criteria:**

**Given** une offre a été capturée en base (statut `captured`) et qu'aucune session Claude Code interactive n'est ouverte
**When** le job cron s'exécute
**Then** il invoque `claude -p` en mode headless avec les instructions du skill de génération de CV
**And** le CV est généré, le patch appliqué, et le statut de la candidature passe à `generated`
**And** l'authentification utilise le login `claude` existant (abonnement Pro) — aucune clé API Anthropic facturée n'est utilisée

**Given** le job cron s'exécute mais aucune offre en statut `captured` n'est en attente
**When** il interroge la base de données
**Then** il ne déclenche aucune génération et se termine sans erreur

**Given** l'automatisation par cron est en place
**When** on la compare à l'automatisation par `/loop` en session interactive
**Then** elle reste fonctionnelle même si aucune session Claude Code n'est ouverte sur la machine — c'est la différence clé qui justifie ce choix par rapport à `/loop`
