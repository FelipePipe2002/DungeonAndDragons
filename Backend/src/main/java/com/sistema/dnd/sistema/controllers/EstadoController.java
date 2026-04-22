package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.EstadoDto;
import com.sistema.dnd.sistema.dto.domain.EstadoUpsertRequest;
import com.sistema.dnd.sistema.services.EstadoService;
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
@RequestMapping("/v1/estados")
public class EstadoController {

    private final EstadoService estadoService;

    public EstadoController(EstadoService estadoService) {
        this.estadoService = estadoService;
    }

    @GetMapping
    public List<EstadoDto> findAll() {
        return estadoService.findAll();
    }

    @GetMapping("/{id}")
    public EstadoDto findById(@PathVariable Long id) {
        return estadoService.findById(id);
    }

    @PostMapping
    public ResponseEntity<EstadoDto> create(@Valid @RequestBody EstadoUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(estadoService.create(request));
    }

    @PutMapping("/{id}")
    public EstadoDto update(@PathVariable Long id, @Valid @RequestBody EstadoUpsertRequest request) {
        return estadoService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        estadoService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
