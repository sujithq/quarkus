package com.example;

import io.quarkus.arc.Arc;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "doctype_sharefolder_mapping")
public class DoctypeShareFolderMapping extends PanacheEntityBase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "doctype_id")
    public String doctypeId;

    @Column(name = "share_folder")
    public String shareFolder;

    public static DoctypeShareFolderMapping findByDoctypeUnsafe(String doctype) {
        EntityManager em = Arc.container()
                .instance(EntityManager.class)
                .get();

        String sql = "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = '" + doctype + "'";

        return (DoctypeShareFolderMapping) em
                .createNativeQuery(sql, DoctypeShareFolderMapping.class)
                .getSingleResult();
    }

    public static DoctypeShareFolderMapping findByDoctypeSafe(String doctype) {
        EntityManager em = Arc.container()
                .instance(EntityManager.class)
                .get();

        return (DoctypeShareFolderMapping) em
                .createNativeQuery(
                        "SELECT * FROM doctype_sharefolder_mapping WHERE doctype_id = ?1",
                        DoctypeShareFolderMapping.class)
                .setParameter(1, doctype)
                .getSingleResult();
    }
}