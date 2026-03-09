package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.BattleStateDto;
import com.sistema.dnd.sistema.dto.domain.BattleStateUpsertRequest;
import com.sistema.dnd.sistema.services.BattleStateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/battle/current")
public class BattleStateController {

    private final BattleStateService battleStateService;

    public BattleStateController(BattleStateService battleStateService) {
        this.battleStateService = battleStateService;
    }

    @GetMapping
    public ResponseEntity<BattleStateDto> findCurrent() {
        BattleStateDto battle = battleStateService.findCurrent();
        if (battle == null) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(battle);
    }

    @PutMapping
    public BattleStateDto updateCurrent(@RequestBody BattleStateUpsertRequest request) {
        return battleStateService.updateCurrent(request);
    }
}
