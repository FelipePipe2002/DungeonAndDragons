package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.BattleStateDto;
import com.sistema.dnd.sistema.dto.domain.BattleSummaryDto;
import com.sistema.dnd.sistema.dto.domain.CreateBattleRequest;
import com.sistema.dnd.sistema.dto.domain.UpdateBattleStateRequest;
import com.sistema.dnd.sistema.services.BattleStateService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/battles")
public class BattleController {

    private final BattleStateService battleStateService;

    public BattleController(BattleStateService battleStateService) {
        this.battleStateService = battleStateService;
    }

    @GetMapping("/active/current")
    public ResponseEntity<BattleStateDto> findCurrentActive() {
        BattleStateDto battle = battleStateService.findCurrent();
        if (battle == null) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(battle);
    }

    @GetMapping("/active")
    public ResponseEntity<BattleStateDto> findActiveByScene(
        @RequestParam String sceneType,
        @RequestParam String sceneSlug
    ) {
        BattleStateDto battle = battleStateService.findActiveByScene(sceneType, sceneSlug);
        if (battle == null) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(battle);
    }

    @GetMapping
    public List<BattleSummaryDto> findHistory(
        @RequestParam String parentLandmarkSlug,
        @RequestParam(required = false) String sceneType,
        @RequestParam(required = false) String sceneSlug
    ) {
        return battleStateService.findHistory(parentLandmarkSlug, sceneType, sceneSlug);
    }

    @GetMapping("/{id}")
    public BattleStateDto findById(@PathVariable Long id) {
        return battleStateService.findById(id);
    }

    @PostMapping
    public ResponseEntity<BattleStateDto> create(@RequestBody CreateBattleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(battleStateService.create(request));
    }

    @PutMapping("/{id}")
    public BattleStateDto update(@PathVariable Long id, @RequestBody UpdateBattleStateRequest request) {
        return battleStateService.update(id, request);
    }

    @PostMapping("/{id}/finish")
    public BattleStateDto finish(@PathVariable Long id) {
        return battleStateService.finish(id);
    }

    @PostMapping("/{id}/reopen")
    public BattleStateDto reopen(@PathVariable Long id) {
        return battleStateService.reopen(id);
    }
}
