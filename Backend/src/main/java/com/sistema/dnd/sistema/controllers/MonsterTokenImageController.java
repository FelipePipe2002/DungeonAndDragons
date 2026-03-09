package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.MonsterTokenImageResolveDto;
import com.sistema.dnd.sistema.services.MonsterTokenImageService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/monster-token-images")
public class MonsterTokenImageController {

    private final MonsterTokenImageService monsterTokenImageService;

    public MonsterTokenImageController(MonsterTokenImageService monsterTokenImageService) {
        this.monsterTokenImageService = monsterTokenImageService;
    }

    @GetMapping("/resolve")
    public MonsterTokenImageResolveDto resolve(
        @RequestParam("name") String name,
        @RequestParam("source") List<String> source
    ) {
        return monsterTokenImageService.resolve(name, source);
    }
}
