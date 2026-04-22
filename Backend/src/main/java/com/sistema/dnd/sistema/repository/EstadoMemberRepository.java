package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.EstadoMemberEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstadoMemberRepository extends JpaRepository<EstadoMemberEntity, Long> {

    List<EstadoMemberEntity> findByEstado_IdOrderByIdAsc(Long estadoId);

    void deleteByEstado_Id(Long estadoId);
}
