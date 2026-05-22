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
