import * as Phaser from 'phaser';
import { PLAYER, DODGE, COMBAT } from '../config/gameConfig';
import { ControlsConfig } from '../config/controls';
import { eventBus } from '../systems/core/EventBus';
import { runStats } from '../systems/core/RunStats';
import { metaProgress } from '../systems/core/MetaProgress';
import { DebugConsoleScene } from '../scenes/DebugConsoleScene';
import type { PlayerState } from '../types';

const STAGGER_MS = 120;
export const ATTACK_HALF_ARC = (140 / 2) * Phaser.Math.DEG_TO_RAD;

export class Player extends Phaser.Physics.Arcade.Sprite {
    private _playerState: PlayerState = 'idle';

    public hp: number = PLAYER.MAX_HP;

    private attackCooldown:     number = 0;
    private swingTimer:         number = 0;
    private invincibilityTimer: number = 0;
    private staggerTimer:       number = 0;
    private dodgeTimer:         number = 0;
    private dodgeCooldown:      number = 0;
    private dodgeVx:            number = 0;
    private dodgeVy:            number = 0;
    private parryWindowTimer:   number = 0;

    private regenTimer: number = 0;

    private upKey!:     Phaser.Input.Keyboard.Key;
    private downKey!:   Phaser.Input.Keyboard.Key;
    private leftKey!:   Phaser.Input.Keyboard.Key;
    private rightKey!:  Phaser.Input.Keyboard.Key;
    private lastVertical:   'up' | 'down' | null = null;
    private lastHorizontal: 'left' | 'right' | null = null;
    private attackKey!:  Phaser.Input.Keyboard.Key;
    private dodgeKey!:   Phaser.Input.Keyboard.Key;
    private altLeftDown: boolean = false;

    private graphic!:    Phaser.GameObjects.Graphics;
    private facingAngle: number = 0;
    private rightPointerDown:   boolean = false;
    private leftPointerDown:    boolean = false;
    private daggerCooldown:     number  = 0;
    private daggerProjectiles:  Phaser.GameObjects.Graphics[] = [];
    public  frozenForCinematic: boolean = false;

    /**
     * Remet à zéro tous les flags d'input — à appeler au resume après une pause
     * pour éviter les inputs fantômes (attaque en boucle, etc.).
     */
    public resetInputState(): void {
        this.rightPointerDown = false;
        this.leftPointerDown  = false;
        this.altLeftDown      = false;
        // Forcer la fin du swing en cours si on était en train d'attaquer
        if (this._playerState === 'attacking') {
            this.swingTimer = 0;
            this.setPlayerState('idle');
        }
    }

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, '');
        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
        scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

        this.hp = runStats.maxHp;

        this.setCollideWorldBounds(true);
        this.setupInput(scene);
        this.setupPointerInput(scene);
        this.graphic = scene.add.graphics();
        this.redrawPlaceholder();
    }

    // ── Setup ─────────────────────────────────────────────────

    private setupInput(scene: Phaser.Scene): void {
        const scheme = ControlsConfig.getCurrentScheme();
        const kb     = scene.input.keyboard!;
        this.upKey     = kb.addKey(scheme.up);
        this.downKey   = kb.addKey(scheme.down);
        this.leftKey   = kb.addKey(scheme.left);
        this.rightKey  = kb.addKey(scheme.right);
        this.attackKey = kb.addKey(scheme.attack);
        this.dodgeKey  = kb.addKey(scheme.defend);
        this.upKey.on('down',    () => { this.lastVertical   = 'up';    });
        this.downKey.on('down',  () => { this.lastVertical   = 'down';  });
        this.leftKey.on('down',  () => { this.lastHorizontal = 'left';  });
        this.rightKey.on('down', () => { this.lastHorizontal = 'right'; });
        this.upKey.on('up',    () => { if (this.lastVertical   === 'up')    this.lastVertical   = this.downKey.isDown  ? 'down'  : null; });
        this.downKey.on('up',  () => { if (this.lastVertical   === 'down')  this.lastVertical   = this.upKey.isDown    ? 'up'    : null; });
        this.leftKey.on('up',  () => { if (this.lastHorizontal === 'left')  this.lastHorizontal = this.rightKey.isDown ? 'right' : null; });
        this.rightKey.on('up', () => { if (this.lastHorizontal === 'right') this.lastHorizontal = this.leftKey.isDown  ? 'left'  : null; });
    }

    public rebindKeys(): void {
        const scheme = ControlsConfig.getCurrentScheme();
        const kb     = this.scene.input.keyboard!;
        kb.removeKey(this.upKey);
        kb.removeKey(this.downKey);
        kb.removeKey(this.leftKey);
        kb.removeKey(this.rightKey);
        kb.removeKey(this.attackKey);
        kb.removeKey(this.dodgeKey);
        this.upKey     = kb.addKey(scheme.up);
        this.downKey   = kb.addKey(scheme.down);
        this.leftKey   = kb.addKey(scheme.left);
        this.rightKey  = kb.addKey(scheme.right);
        this.attackKey = kb.addKey(scheme.attack);
        this.dodgeKey  = kb.addKey(scheme.defend);
        this.upKey.on('down',    () => { this.lastVertical   = 'up';    });
        this.downKey.on('down',  () => { this.lastVertical   = 'down';  });
        this.leftKey.on('down',  () => { this.lastHorizontal = 'left';  });
        this.rightKey.on('down', () => { this.lastHorizontal = 'right'; });
        this.upKey.on('up',    () => { if (this.lastVertical   === 'up')    this.lastVertical   = this.downKey.isDown  ? 'down'  : null; });
        this.downKey.on('up',  () => { if (this.lastVertical   === 'down')  this.lastVertical   = this.upKey.isDown    ? 'up'    : null; });
        this.leftKey.on('up',  () => { if (this.lastHorizontal === 'left')  this.lastHorizontal = this.rightKey.isDown ? 'right' : null; });
        this.rightKey.on('up', () => { if (this.lastHorizontal === 'right') this.lastHorizontal = this.leftKey.isDown  ? 'left'  : null; });
    }

    private setupPointerInput(scene: Phaser.Scene): void {
        const canvas = scene.game.canvas;

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';
        canvas.focus();
        canvas.addEventListener('mousedown', () => canvas.focus());

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.code === 'AltLeft') {
                e.preventDefault();
                e.stopPropagation();
                this.altLeftDown = true;
            }
        }, { capture: true });
        window.addEventListener('keyup', (e: KeyboardEvent) => {
            if (e.code === 'AltLeft') this.altLeftDown = false;
        }, { capture: true });
        scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (ptr.rightButtonDown()) this.rightPointerDown = true;
            if (ptr.leftButtonDown())  this.leftPointerDown  = true;
        });
        scene.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
            if (ptr.button === 2) this.rightPointerDown = false;
            if (ptr.button === 0) this.leftPointerDown  = false;
        });
    }

    // ── Getters stats (depuis RunStats) ──────────────────────

    /** Multiplicateur de dégâts effectif depuis RunStats */
    get attackMultiplier(): number { return runStats.attackMultiplier; }

    /** Portée d'attaque effective depuis RunStats */
    get effectiveAttackRange(): number { return runStats.attackRange; }

    get isAttacking():       boolean { return this.swingTimer > 0; }
    get attackFacingAngle(): number  { return this.facingAngle; }
    get isDodging():         boolean { return this._playerState === 'dodging'; }
    get isInvincible():      boolean { return this.invincibilityTimer > 0; }
    get playerState():       PlayerState { return this._playerState; }

    // ── Visuel ────────────────────────────────────────────────

    private redrawPlaceholder(): void {
        this.graphic.clear();
        const isInvincible = this.invincibilityTimer > 0;
        const blinkVisible = !isInvincible || Math.floor(this.invincibilityTimer / 120) % 2 === 0;
        if (!blinkVisible) return;
        const alpha = isInvincible ? 0.55 : 1;

        this.graphic.fillStyle(0x3498db, alpha);
        this.graphic.lineStyle(3, 0x2980b9, alpha);
        this.graphic.fillCircle(this.x, this.y, 16);
        this.graphic.strokeCircle(this.x, this.y, 16);

        const tipX = this.x + Math.cos(this.facingAngle) * 22;
        const tipY = this.y + Math.sin(this.facingAngle) * 22;
        this.graphic.fillStyle(0xecf0f1, alpha);
        this.graphic.fillTriangle(
            tipX, tipY,
            this.x + Math.cos(this.facingAngle + 2.4) * 10,
            this.y + Math.sin(this.facingAngle + 2.4) * 10,
            this.x + Math.cos(this.facingAngle - 2.4) * 10,
            this.y + Math.sin(this.facingAngle - 2.4) * 10,
        );

        if (this.swingTimer > 0) {
            const r          = runStats.attackRange;
            const startAngle = this.facingAngle - ATTACK_HALF_ARC;
            const endAngle   = this.facingAngle + ATTACK_HALF_ARC;
            const steps      = 16;
            this.graphic.fillStyle(0xe67e22, 0.2);
            this.graphic.beginPath();
            this.graphic.moveTo(this.x, this.y);
            for (let i = 0; i <= steps; i++) {
                const a = startAngle + (endAngle - startAngle) * (i / steps);
                this.graphic.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
            }
            this.graphic.closePath();
            this.graphic.fillPath();
            this.graphic.lineStyle(3, 0xe67e22, 0.9);
            this.graphic.beginPath();
            for (let i = 0; i <= steps; i++) {
                const a = startAngle + (endAngle - startAngle) * (i / steps);
                if (i === 0) this.graphic.moveTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
                else         this.graphic.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
            }
            this.graphic.strokePath();
            this.graphic.lineBetween(this.x, this.y, this.x + Math.cos(startAngle) * r, this.y + Math.sin(startAngle) * r);
            this.graphic.lineBetween(this.x, this.y, this.x + Math.cos(endAngle)   * r, this.y + Math.sin(endAngle)   * r);
        }

        if (this._playerState === 'dodging') {
            this.graphic.lineStyle(4, 0x00e5ff, 0.9);
            this.graphic.strokeCircle(this.x, this.y, 20);
        }
        if (this._playerState === 'defending') {
            this.graphic.lineStyle(4, 0xf1c40f, 0.9);
            this.graphic.strokeCircle(this.x, this.y, 22);
        }
        if (this.staggerTimer > 0) {
            this.graphic.lineStyle(3, 0xe74c3c, 0.8);
            this.graphic.strokeCircle(this.x, this.y, 18);
        }
    }

    // ── State machine ─────────────────────────────────────────

    private setPlayerState(next: PlayerState): void {
        if (this._playerState === next) return;
        this._playerState = next;
    }

    // ── Update loop ───────────────────────────────────────────

    update(delta: number): void {
        if (this._playerState === 'dead') return;
        if (this.frozenForCinematic) { this.setVelocity(0, 0); this.redrawPlaceholder(); return; }
        this.handleCombatInput();
        this.updateTimers(delta);
        this.handleMovement();
        this.handleRegen(delta);
        this.redrawPlaceholder();
    }

    private updateTimers(delta: number): void {
        if (this.swingTimer         > 0) this.swingTimer         -= delta;
        if (this.attackCooldown     > 0) this.attackCooldown     -= delta;
        if (this.invincibilityTimer > 0) this.invincibilityTimer -= delta;
        if (this.staggerTimer       > 0) this.staggerTimer       -= delta;
        if (this.dodgeTimer         > 0) this.dodgeTimer         -= delta;
        if (this.dodgeCooldown      > 0) this.dodgeCooldown      -= delta;
        if (this.parryWindowTimer   > 0) this.parryWindowTimer   -= delta;
        if (this.daggerCooldown     > 0) this.daggerCooldown     -= delta;

        if (this._playerState === 'attacking' && this.swingTimer <= 0) this.setPlayerState('idle');
        if (this._playerState === 'hit'       && this.staggerTimer <= 0) this.setPlayerState('idle');
        if (this._playerState === 'dodging'   && this.dodgeTimer <= 0) {
            this.setPlayerState('idle');
            this.setVelocity(0, 0);
        }
        if (this._playerState === 'defending' && this.parryWindowTimer <= 0) this.setPlayerState('idle');
    }

    private handleMovement(): void {
        if (this.staggerTimer > 0) { this.setVelocity(0, 0); return; }
        if (this._playerState === 'dodging') { this.setVelocity(this.dodgeVx, this.dodgeVy); return; }

        const speed = runStats.speed;
        let vx = 0, vy = 0;
        const bothH = this.leftKey.isDown && this.rightKey.isDown;
        const bothV = this.upKey.isDown   && this.downKey.isDown;
        if (bothH) {
            if (this.lastHorizontal === 'left')  vx -= speed;
            else                                  vx += speed;
        } else {
            if (this.leftKey.isDown)  vx -= speed;
            if (this.rightKey.isDown) vx += speed;
        }
        if (bothV) {
            if (this.lastVertical === 'up')  vy -= speed;
            else                              vy += speed;
        } else {
            if (this.upKey.isDown)   vy -= speed;
            if (this.downKey.isDown) vy += speed;
        }
        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
        this.setVelocity(vx, vy);

        const ptr = this.scene.input.activePointer;
        const dx  = ptr.x - this.x;
        const dy  = ptr.y - this.y;
        if (dx !== 0 || dy !== 0) {
            this.facingAngle = Math.atan2(dy, dx);
        }

        if ((vx !== 0 || vy !== 0) && this._playerState === 'idle')    this.setPlayerState('moving');
        else if (vx === 0 && vy === 0 && this._playerState === 'moving') this.setPlayerState('idle');
    }

    /** Regen passif depuis RunStats (envie). */
    private handleRegen(delta: number): void {
        const interval = runStats.regenIntervalMs;
        if (!interval) return;
        if (this.hp >= runStats.maxHp) { this.regenTimer = 0; return; }
        this.regenTimer += delta;
        if (this.regenTimer >= interval) {
            this.regenTimer = 0;
            this.heal(1);
        }
    }

    private handleCombatInput(): void {
        const wantsAttack =
            Phaser.Input.Keyboard.JustDown(this.attackKey) ||
            (this.leftPointerDown && this.attackCooldown <= 0);

        if (
            wantsAttack &&
            this.staggerTimer <= 0 &&
            this._playerState !== 'dodging' &&
            (this._playerState === 'idle' || this._playerState === 'moving' || this._playerState === 'hit') &&
            this.attackCooldown <= 0
        ) {
            this.setPlayerState('attacking');
            this.swingTimer     = PLAYER.ATTACK_SWING_MS;
            this.attackCooldown = PLAYER.ATTACK_COOLDOWN_MS;
        }

        if (
            Phaser.Input.Keyboard.JustDown(this.dodgeKey) &&
            this.staggerTimer  <= 0 &&
            this.dodgeCooldown <= 0 &&
            this._playerState !== 'dodging' &&
            this._playerState !== 'dead'
        ) {
            let dx = 0, dy = 0;
            if (this.leftKey.isDown)  dx -= 1;
            if (this.rightKey.isDown) dx += 1;
            if (this.upKey.isDown)    dy -= 1;
            if (this.downKey.isDown)  dy += 1;
            if (dx === 0 && dy === 0) { dx = Math.cos(this.facingAngle); dy = Math.sin(this.facingAngle); }
            else { const len = Math.sqrt(dx * dx + dy * dy); dx /= len; dy /= len; }

            this.dodgeVx = dx * DODGE.DASH_SPEED;
            this.dodgeVy = dy * DODGE.DASH_SPEED;
            this.setPlayerState('dodging');
            this.dodgeTimer         = DODGE.DASH_MS;
            this.dodgeCooldown      = runStats.dashCooldown;
            this.invincibilityTimer = DODGE.INVINCIBILITY_MS;
        }

        const wantsRightClick = this.rightPointerDown || this.altLeftDown;
        if (
            wantsRightClick &&
            this.staggerTimer  <= 0 &&
            this._playerState !== 'dodging' &&
            this._playerState !== 'dead'
        ) {
            if (runStats.daggerUnlocked) {
                const ptr = this.scene.input.activePointer;
                this.throwDagger(ptr.x, ptr.y);
                this.rightPointerDown = false;
                this.altLeftDown      = false;
            } else if (
                this._playerState !== 'attacking' &&
                this._playerState !== 'defending'
            ) {
                this.setPlayerState('defending');
                this.parryWindowTimer = COMBAT.PARRY_WINDOW_MS;
                this.rightPointerDown = false;
                this.altLeftDown      = false;
            }

            // Le parry reste accessible même avec la dague débloquée
            if (
                runStats.daggerUnlocked &&
                this._playerState !== 'attacking' &&
                this._playerState !== 'defending' &&
                this.parryWindowTimer <= 0
            ) {
                this.setPlayerState('defending');
                this.parryWindowTimer = COMBAT.PARRY_WINDOW_MS;
            }
        }
    }

    // ── Combat ────────────────────────────────────────────────

    public receiveHit(damage: number): boolean {
        void damage;
        if (this._playerState === 'dead') return false;
        if (DebugConsoleScene.godMode) return false;
        if (this._playerState === 'defending' && this.parryWindowTimer > 0) {
            eventBus.emit('PERFECT_PARRY', {});
            this.setPlayerState('idle');
            return false;
        }
        if (this.invincibilityTimer > 0) return false;

        this.hp -= 1;
        eventBus.emit('PLAYER_HIT', { hp: this.hp });
        if (this.hp <= 0) {
            this.hp = 0;
            this.setPlayerState('dead');
            eventBus.emit('PLAYER_DEAD', {});
            return true;
        }
        this.staggerTimer       = STAGGER_MS;
        this.setPlayerState('hit');
        this.invincibilityTimer = runStats.invincibilityMs;
        return false;
    }


    /**
     * Rend le joueur invincible pendant `durationMs` millisecondes.
     * Utilisé par les cinématiques pour éviter les dégâts pendant les transitions.
     */
    public makeInvincible(durationMs: number): void {
        this.invincibilityTimer = durationMs;
    }

    public heal(amount: number = 1): void {
        if (this._playerState === 'dead') return;
        const maxHp = runStats.maxHp;
        if (this.hp >= maxHp) return;
        this.hp = Math.min(this.hp + amount, maxHp);
        eventBus.emit('PLAYER_HEALED', { hp: this.hp });
    }

    destroyPlayer(): void {
        this.graphic.destroy();
        this.destroy();
    }

    private throwDagger(targetX: number, targetY: number): void {
        if (this.daggerCooldown > 0) return;
        if (this._playerState === 'dead') return;

        this.daggerCooldown = 600;

        const angle    = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const speed    = 480;
        const dmg      = Math.round(10 * runStats.attackMultiplier);
        const MAX_RANGE = 280;
        const startX   = this.x;
        const startY   = this.y;

        const g = this.scene.add.graphics();
        g.fillStyle(0xc8c8e8, 1);
        g.fillRect(-10, -2, 20, 4);
        g.fillStyle(0xffffff, 0.7);
        g.fillRect(8, -1, 4, 2);
        g.x = this.x;
        g.y = this.y;
        g.rotation = angle;
        g.setDepth(5);
        this.daggerProjectiles.push(g);

        const vx  = Math.cos(angle) * speed;
        const vy  = Math.sin(angle) * speed;
        let   hit = false;

        const destroy = () => {
            g.destroy();
            this.daggerProjectiles = this.daggerProjectiles.filter(d => d !== g);
            ticker.remove();
        };

        const ticker = this.scene.time.addEvent({
            delay: 16, loop: true,
            callback: () => {
                g.x += vx * 0.016;
                g.y += vy * 0.016;

                if (!hit) {
                    this.scene.events.emit('DAGGER_UPDATE', {
                        x: g.x, y: g.y, damage: dmg,
                        poison: runStats.poisonUnlocked,
                        onHit: () => { hit = true; destroy(); },
                    });
                }

                const dist = Phaser.Math.Distance.Between(startX, startY, g.x, g.y);
                if (dist >= MAX_RANGE) destroy();
            },
        });
    }
}