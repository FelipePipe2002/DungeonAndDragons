package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "battle_states")
@Getter
@Setter
public class BattleStateEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "scene_type", nullable = false, length = 20)
    private BattleSceneType sceneType = BattleSceneType.LANDMARK;

    @Column(name = "scene_slug", nullable = false, length = 255)
    private String sceneSlug;

    @Column(name = "parent_landmark_slug", nullable = false, length = 255)
    private String parentLandmarkSlug;

    @Column(name = "title", nullable = false, length = 255)
    private String title = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BattleStatus status = BattleStatus.ACTIVE;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @Column(name = "round_number", nullable = false)
    private Integer roundNumber = 1;

    @Column(name = "dm_notes", columnDefinition = "TEXT")
    private String dmNotes;

    @Column(name = "next_token_number", nullable = false)
    private Integer nextTokenNumber = 1;

    @Column(name = "current_turn_token_number")
    private Integer currentTurnTokenNumber;

    @Column(name = "tokens_json", nullable = false, columnDefinition = "TEXT")
    private String tokensJson = "[]";

    @Column(name = "next_obstacle_id", nullable = false)
    private Integer nextObstacleId = 1;

    @Column(name = "obstacles_json", nullable = false, columnDefinition = "TEXT")
    private String obstaclesJson = "[]";

    @Column(name = "fog_enabled", nullable = false)
    private Boolean fogEnabled = false;

    @Column(name = "next_fog_reveal_id", nullable = false)
    private Integer nextFogRevealId = 1;

    @Column(name = "fog_reveals_json", nullable = false, columnDefinition = "TEXT")
    private String fogRevealsJson = "[]";

    @Column(name = "dungeon_fog_json", nullable = false, columnDefinition = "TEXT")
    private String dungeonFogJson = "{\"enabled\":false,\"exploredCellKeys\":[],\"playerVisionBrightRadiusCells\":4,\"playerVisionDimRadiusCells\":8}";
}
