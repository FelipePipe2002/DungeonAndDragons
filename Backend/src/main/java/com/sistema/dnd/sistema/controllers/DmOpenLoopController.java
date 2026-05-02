package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.DmOpenLoopDto;
import com.sistema.dnd.sistema.dto.domain.DmOpenLoopUpsertRequest;
import com.sistema.dnd.sistema.services.DmOpenLoopService;
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
@RequestMapping("/v1/dm-open-loops")
public class DmOpenLoopController {

    private final DmOpenLoopService dmOpenLoopService;

    public DmOpenLoopController(DmOpenLoopService dmOpenLoopService) {
        this.dmOpenLoopService = dmOpenLoopService;
    }

    @GetMapping
    public List<DmOpenLoopDto> findAll() {
        return dmOpenLoopService.findAll();
    }

    @PostMapping
    public ResponseEntity<DmOpenLoopDto> create(@Valid @RequestBody DmOpenLoopUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmOpenLoopService.create(request));
    }

    @PutMapping("/{id}")
    public DmOpenLoopDto update(@PathVariable Long id, @Valid @RequestBody DmOpenLoopUpsertRequest request) {
        return dmOpenLoopService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        dmOpenLoopService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
