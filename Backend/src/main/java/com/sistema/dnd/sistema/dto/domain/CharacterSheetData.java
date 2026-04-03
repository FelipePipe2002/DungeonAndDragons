package com.sistema.dnd.sistema.dto.domain;

import java.util.List;
import java.util.Map;

public record CharacterSheetData(
    String name,
    String race,
    String alignment,
    String background,
    Integer competence_bonus,
    List<CharacterClassData> classes,
    Object speed,
    HitPointsData hit_points,
    Map<String, AbilityScoreEntryData> ability_scores,
    Map<String, Object> skills,
    ArmorClassData armor_class,
    List<String> languages,
    DetailsData details,
    List<String> competences,
    List<WeaponData> weapons,
    ArmorData armor,
    List<String> inventory
) {
    public record CharacterClassData(
        String name,
        String subtype,
        Integer level,
        String hit_die
    ) {
    }

    public record HitPointsData(
        Integer max,
        Integer current
    ) {
    }

    public record AbilityScoreEntryData(
        Integer score,
        Boolean saving
    ) {
    }

    public record ArmorClassData(
        Integer value,
        String description
    ) {
    }

    public record DetailsData(
        String personality,
        String ideal,
        String bond,
        String flaw
    ) {
    }

    public record WeaponData(
        String name,
        String damage,
        String damage_type,
        List<String> properties,
        Boolean mastery,
        String mastery_description
    ) {
    }

    public record ArmorData(
        String name,
        Integer ac_bonus,
        Boolean dex_bonus,
        Integer capped_dex_bonus,
        Boolean stealth_disadvantage
    ) {
    }
}
