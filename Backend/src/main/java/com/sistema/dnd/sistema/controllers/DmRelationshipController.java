package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.DmRelationshipDto;
import com.sistema.dnd.sistema.dto.domain.DmRelationshipUpsertRequest;
import com.sistema.dnd.sistema.services.DmRelationshipService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/dm-relationships")
public class DmRelationshipController {

    private final DmRelationshipService dmRelationshipService;

    public DmRelationshipController(DmRelationshipService dmRelationshipService) {
        this.dmRelationshipService = dmRelationshipService;
    }

    @GetMapping
    public List<DmRelationshipDto> findAll() {
        return dmRelationshipService.findAll();
    }

    @PostMapping
    public ResponseEntity<DmRelationshipDto> create(@Valid @RequestBody DmRelationshipUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmRelationshipService.create(request));
    }

    @PutMapping("/{id}")
    public DmRelationshipDto update(@PathVariable Long id, @Valid @RequestBody DmRelationshipUpsertRequest request) {
        return dmRelationshipService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        dmRelationshipService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
