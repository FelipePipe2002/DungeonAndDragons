package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.DmEventDto;
import com.sistema.dnd.sistema.dto.domain.DmEventUpsertRequest;
import com.sistema.dnd.sistema.services.DmEventService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/dm-events")
public class DmEventController {

    private final DmEventService dmEventService;

    public DmEventController(DmEventService dmEventService) {
        this.dmEventService = dmEventService;
    }

    @GetMapping
    public List<DmEventDto> findAll() {
        return dmEventService.findAll();
    }

    @PostMapping
    public ResponseEntity<DmEventDto> create(@Valid @RequestBody DmEventUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmEventService.create(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        dmEventService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
