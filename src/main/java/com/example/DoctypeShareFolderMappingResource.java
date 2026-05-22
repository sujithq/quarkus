package com.example;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/doctype-share-folder-mappings")
@Produces(MediaType.APPLICATION_JSON)
public class DoctypeShareFolderMappingResource {
    @GET
    @Path("/unsafe")
    public DoctypeShareFolderMapping findUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeUnsafe(doctype);
    }

    @GET
    @Path("/safe")
    public DoctypeShareFolderMapping findSafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeSafe(doctype);
    }

    @GET
    @Path("/jpa-query-unsafe")
    public List<DoctypeShareFolderMapping> findJpaQueryUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeJpaQueryUnsafe(doctype);
    }

    @GET
    @Path("/jpa-query-safe")
    public List<DoctypeShareFolderMapping> findJpaQuerySafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeJpaQuerySafe(doctype);
    }

    @GET
    @Path("/hibernate-query-unsafe")
    public List<DoctypeShareFolderMapping> findHibernateQueryUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeHibernateQueryUnsafe(doctype);
    }

    @GET
    @Path("/hibernate-query-safe")
    public List<DoctypeShareFolderMapping> findHibernateQuerySafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeHibernateQuerySafe(doctype);
    }

    @GET
    @Path("/hibernate-native-unsafe")
    public List<DoctypeShareFolderMapping> findHibernateNativeUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeHibernateNativeUnsafe(doctype);
    }

    @GET
    @Path("/hibernate-native-safe")
    public List<DoctypeShareFolderMapping> findHibernateNativeSafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypeHibernateNativeSafe(doctype);
    }

    @GET
    @Path("/panache-unsafe")
    public List<DoctypeShareFolderMapping> findPanacheUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypePanacheUnsafe(doctype);
    }

    @GET
    @Path("/panache-find-unsafe")
    public List<DoctypeShareFolderMapping> findPanacheFindUnsafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypePanacheFindUnsafe(doctype);
    }

    @GET
    @Path("/panache-safe")
    public List<DoctypeShareFolderMapping> findPanacheSafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypePanacheSafe(doctype);
    }

    @GET
    @Path("/panache-find-safe")
    public List<DoctypeShareFolderMapping> findPanacheFindSafe(@QueryParam("doctype") String doctype) {
        return DoctypeShareFolderMapping.findByDoctypePanacheFindSafe(doctype);
    }
}
